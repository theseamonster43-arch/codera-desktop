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
    // codera:// — how a sign-in done in the browser gets its answer back here.
    .plugin(tauri_plugin_deep_link::init())
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
      match event {
        tauri::WindowEvent::ThemeChanged(_) => {
          #[cfg(windows)]
          caption::paint(window);
        }
        #[cfg(target_os = "macos")]
        tauri::WindowEvent::Resized(_) => mac::on_resized(window),
        _ => {}
      }
      #[cfg(not(any(windows, target_os = "macos")))]
      let _ = window;
    })
    .invoke_handler(tauri::generate_handler![codera_fullscreen])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

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

/// Fullscreen on or off: the page's Ctrl+Cmd+F and its green button in fullscreen call this.
#[tauri::command]
fn codera_fullscreen(window: tauri::Window) {
  let on = window.is_fullscreen().unwrap_or(false);
  let _ = window.set_fullscreen(!on);
}

/// macOS fullscreen with Codera's bar as the header.
///
/// The window uses the Mac's real fullscreen. When the pointer reaches the top of
/// the screen the menu bar still slides down as usual, but Apple's title strip that
/// normally comes with it is hidden and lets clicks through. Instead the page is
/// told, many times a second while fullscreen, how far the menu bar has pushed into
/// the window and whether the strip is out, so Codera's own bar moves down with the
/// menu bar and shows the traffic lights.
#[cfg(target_os = "macos")]
mod mac {
  use std::sync::atomic::{AtomicBool, Ordering};
  use std::sync::Mutex;
  use std::time::Duration;

  use objc2::rc::Retained;
  use objc2_app_kit::{NSView, NSWindow, NSWindowButton};
  use tauri::Emitter;

  static FULL: AtomicBool = AtomicBool::new(false);
  static LAST: Mutex<Option<(i32, bool)>> = Mutex::new(None);

  fn ns_window(window: &tauri::Window) -> Option<Retained<NSWindow>> {
    let ptr = window.ns_window().ok()? as *mut NSWindow;
    unsafe { Retained::retain(ptr) }
  }

  /// The view that holds Apple's title strip, traffic lights included.
  fn title_strip(ns: &NSWindow) -> Option<Retained<NSView>> {
    let close = ns.standardWindowButton(NSWindowButton::CloseButton)?;
    // The button sits in a row view, inside the strip itself.
    let row = unsafe { close.superview() }?;
    unsafe { row.superview() }
  }

  pub fn on_resized(window: &tauri::Window) {
    if window.label() != "main" {
      return;
    }
    let now = window.is_fullscreen().unwrap_or(false);
    if FULL.swap(now, Ordering::SeqCst) == now {
      return;
    }
    if let Some(strip) = ns_window(window).as_deref().and_then(title_strip) {
      strip.setHidden(now);
    }
    *LAST.lock().unwrap() = None;
    let _ = window.emit("codera://fullscreen", now);

    if now {
      let window = window.clone();
      std::thread::spawn(move || {
        while FULL.load(Ordering::SeqCst) {
          std::thread::sleep(Duration::from_millis(25));
          let w = window.clone();
          let _ = window.run_on_main_thread(move || tick(&w));
        }
      });
    } else {
      let _ = window.emit("codera://reveal", serde_json::json!({ "push": 0, "lights": false }));
    }
  }

  fn tick(window: &tauri::Window) {
    if !FULL.load(Ordering::SeqCst) {
      return;
    }
    let Some(ns) = ns_window(window) else { return };
    let Some(strip) = title_strip(&ns) else { return };
    if !strip.isHidden() {
      strip.setHidden(true);
    }
    let Some(holder) = strip.window() else { return };

    let (push, lights) = if Retained::as_ptr(&holder) == Retained::as_ptr(&ns) {
      // The strip has not moved into its own fullscreen window yet.
      (0, false)
    } else {
      // In fullscreen AppKit keeps the strip in a separate window it slides down under
      // the menu bar. That window must not swallow clicks meant for Codera's bar.
      holder.setIgnoresMouseEvents(true);
      let win = ns.frame();
      let strip_frame = holder.frame();
      let win_top = win.origin.y + win.size.height;
      let strip_top = strip_frame.origin.y + strip_frame.size.height;
      // How far below the window's top edge the strip starts: the room the menu bar
      // takes inside the window (none on a Mac whose menu bar sits beside the notch).
      let push = (win_top - strip_top).round().clamp(0.0, 64.0) as i32;
      // Out, when any of it is inside the window.
      let lights = strip_frame.origin.y < win_top - 1.0;
      (push, lights)
    };

    let mut last = LAST.lock().unwrap();
    if *last != Some((push, lights)) {
      *last = Some((push, lights));
      let _ = window.emit("codera://reveal", serde_json::json!({ "push": push, "lights": lights }));
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
