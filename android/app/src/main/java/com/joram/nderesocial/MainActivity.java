package com.joram.nderesocial;

import android.os.Build;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import com.getcapacitor.BridgeActivity;

/**
 * Capacitor MainActivity that grants the WebView the runtime permissions it
 * asks for (camera / microphone). Without this override, getUserMedia() on
 * Android always fails with "Permission denied" even when the Android system
 * permission is already granted — the WebView itself blocks the request.
 *
 * After modifying this file run `npx cap sync android` and rebuild the APK.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onStart() {
    super.onStart();
    if (this.bridge != null && this.bridge.getWebView() != null) {
      this.bridge.getWebView().setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(this.bridge) {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            request.grant(request.getResources());
          }
        }
      });
    }
  }
}
