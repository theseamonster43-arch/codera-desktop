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
    // Windows keeps its real title bar and buttons; each window's bar is tinted to
    // Codera's background once its page loads, and again if the system theme flips.
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

/// The colour of the real Windows title bar.
///
/// Windows 11 lets an app tint its caption through DWM, so the system's own
/// minimise, maximise and close buttons stay — snap layouts and all — while the
/// bar matches the app instead of sitting above it in grey. Windows 10 ignores
/// the request and keeps its usual bar, which is fine.
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

fn bring_back(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}
