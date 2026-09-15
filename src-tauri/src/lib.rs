use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager,
};

/// Codera's native shell.
///
/// Deliberately thin: everything a person sees is the web UI in `src/`, which
/// talks to Firebase and Stripe itself. The shell only adds what a browser tab
/// cannot — a tray icon, system notifications, links opened in the real
/// browser, and the always-on-top mini player window.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_opener::init())
    // On Windows each window's frame is tinted to Codera's background once its page
    // loads, and again if the system theme flips.
    .on_page_load(|webview, _| {
      #[cfg(windows)]
      caption::paint(&webview.window());
      #[cfg(not(windows))]
      let _ = webview;
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::ThemeChanged(_) = event {
        #[cfg(windows)]
        caption::paint(window);
        #[cfg(not(windows))]
        let _ = window;
      }
    })
    .invoke_handler(tauri::generate_handler![codera_fullscreen, codera_lights])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "macos")]
      mac::setup(app.handle());

      // The tray: a way back to the window, and a way out.
      let show = MenuItem::with_id(app, "show", "Open Codera", true, None::<&str>)?;
      let quit = MenuItem::with_id(app, "quit", "Quit Codera", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show, &quit])?;

      TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Codera")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "show" => bring_back(app),
          "quit" => app.exit(0),
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          // A plain click on the icon brings the window forward.
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            bring_back(tray.app_handle());
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Codera");
}

/// The colour of the window's frame on Windows.
///
/// The main window draws its own title bar, but Windows 11 still paints a thin
/// border around it; DWM lets an app tint that to Codera's background instead of
/// grey. Windows 10 ignores the request, which is fine.
#[cfg(windows)]
mod caption {
  use std::ffi::c_void;

  #[link(name = "dwmapi")]
  extern "system" {
    fn DwmSetWindowAttribute(hwnd: *mut c_void, attr: u32, value: *const c_void, size: u32) -> i32;
  }

  const DWMWA_BORDER_COLOR: u32 = 34;
  const DWMWA_CAPTION_COLOR: u32 = 35;
  const DWMWA_TEXT_COLOR: u32 = 36;

  pub fn paint(window: &tauri::Window) {
    let dark = matches!(window.theme(), Ok(tauri::Theme::Dark));
    // COLORREF is 0x00BBGGRR: the app's --bg and --text for each theme.
    let (bg, text): (u32, u32) = if dark {
      (0x000a_0c08, 0x00e4_e8e2) // #080c0a, #e2e8e4
    } else {
      (0x00f6_f7f5, 0x0014_1a0f) // #f5f7f6, #0f1a14
    };
    if let Ok(hwnd) = window.hwnd() {
      let hwnd = hwnd.0 as *mut c_void;
      let size = std::mem::size_of::<u32>() as u32;
      unsafe {
        DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, &bg as *const u32 as *const c_void, size);
        DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &bg as *const u32 as *const c_void, size);
        DwmSetWindowAttribute(hwnd, DWMWA_TEXT_COLOR, &text as *const u32 as *const c_void, size);
      }
    }
  }
}

/// Codera's fullscreen: on or off. The page's Ctrl+Cmd+F and the exit button call this.
#[tauri::command]
fn codera_fullscreen(window: tauri::Window) {
  #[cfg(target_os = "macos")]
  {
    let _ = window;
    mac::toggle();
  }
  #[cfg(not(target_os = "macos"))]
  {
    let on = window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(!on);
  }
}

/// Shows or hides the traffic lights while in fullscreen; the page asks when the
/// pointer is over Codera's bar.
#[tauri::command]
fn codera_lights(show: bool) {
  #[cfg(target_os = "macos")]
  mac::lights(show);
  #[cfg(not(target_os = "macos"))]
  let _ = show;
}

/// Fullscreen on macOS, done Codera's way.
///
/// The Mac's own fullscreen moves the window to a new Space and, when the pointer
/// reaches the top, slides Apple's grey title strip down over the app. Codera keeps
/// its own bar as the header instead: the green button is pointed at this module,
/// which hides the Dock and menu bar and fills the screen with the window, leaving
/// the real traffic lights in Codera's bar, hidden until the pointer is over it.
#[cfg(target_os = "macos")]
mod mac {
  use std::sync::atomic::{AtomicBool, Ordering};
  use std::sync::{Mutex, OnceLock};

  use objc2::rc::Retained;
  use objc2::runtime::{AnyObject, NSObject};
  use objc2::{define_class, msg_send, sel, MainThreadMarker, MainThreadOnly};
  use objc2_app_kit::{
    NSApplication, NSApplicationPresentationOptions, NSWindow, NSWindowButton, NSWindowCollectionBehavior,
  };
  use objc2_foundation::NSRect;
  use tauri::{Emitter, Manager};

  static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
  static ON: AtomicBool = AtomicBool::new(false);
  static SAVED: Mutex<Option<(NSRect, NSApplicationPresentationOptions)>> = Mutex::new(None);

  define_class!(
    // The green button's new target. It only forwards the press.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "CoderaZoomTarget"]
    struct ZoomTarget;

    impl ZoomTarget {
      #[unsafe(method(coderaZoom:))]
      fn codera_zoom(&self, _sender: Option<&AnyObject>) {
        toggle();
      }
    }
  );

  impl ZoomTarget {
    fn new(mtm: MainThreadMarker) -> Retained<Self> {
      let this = Self::alloc(mtm).set_ivars(());
      unsafe { msg_send![super(this), init] }
    }
  }

  fn main_window() -> Option<Retained<NSWindow>> {
    let window = APP.get()?.get_webview_window("main")?;
    let ptr = window.ns_window().ok()? as *mut NSWindow;
    unsafe { Retained::retain(ptr) }
  }

  pub fn setup(app: &tauri::AppHandle) {
    let _ = APP.set(app.clone());
    let Some(mtm) = MainThreadMarker::new() else { return };
    let Some(ns) = main_window() else { return };

    // No separate Space: the menu item and the green button no longer start Apple's fullscreen.
    let mut behavior = ns.collectionBehavior();
    behavior &= !NSWindowCollectionBehavior::FullScreenPrimary;
    behavior |= NSWindowCollectionBehavior::FullScreenNone;
    ns.setCollectionBehavior(behavior);

    if let Some(zoom) = ns.standardWindowButton(NSWindowButton::ZoomButton) {
      // A control does not keep its target alive, so the target lives for the whole run.
      let target = Retained::into_raw(ZoomTarget::new(mtm));
      unsafe {
        zoom.setTarget(Some(&*(target as *const AnyObject)));
        zoom.setAction(Some(sel!(coderaZoom:)));
      }
    }
  }

  fn set_lights_hidden(ns: &NSWindow, hidden: bool) {
    for kind in [NSWindowButton::CloseButton, NSWindowButton::MiniaturizeButton, NSWindowButton::ZoomButton] {
      if let Some(button) = ns.standardWindowButton(kind) {
        button.setHidden(hidden);
      }
    }
  }

  pub fn lights(show: bool) {
    if !ON.load(Ordering::SeqCst) {
      return;
    }
    if let Some(ns) = main_window() {
      set_lights_hidden(&ns, !show);
    }
  }

  pub fn toggle() {
    let Some(mtm) = MainThreadMarker::new() else { return };
    let Some(ns) = main_window() else { return };
    let app = NSApplication::sharedApplication(mtm);

    if !ON.load(Ordering::SeqCst) {
      let Some(screen) = ns.screen() else { return };
      *SAVED.lock().unwrap() = Some((ns.frame(), app.presentationOptions()));
      // The menu bar has to be gone before a titled window may cover its strip.
      app.setPresentationOptions(
        NSApplicationPresentationOptions::HideDock | NSApplicationPresentationOptions::HideMenuBar,
      );
      ns.setFrame_display(screen.frame(), true);
      ns.setMovable(false);
      set_lights_hidden(&ns, true);
      ON.store(true, Ordering::SeqCst);
    } else {
      let saved = SAVED.lock().unwrap().take();
      if let Some((frame, options)) = saved {
        app.setPresentationOptions(options);
        ns.setFrame_display(frame, true);
      }
      ns.setMovable(true);
      set_lights_hidden(&ns, false);
      ON.store(false, Ordering::SeqCst);
    }

    if let Some(app) = APP.get() {
      let _ = app.emit("codera://fullscreen", ON.load(Ordering::SeqCst));
    }
  }
}

fn bring_back(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}
