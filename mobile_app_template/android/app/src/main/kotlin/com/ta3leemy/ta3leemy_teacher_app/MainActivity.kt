package com.ta3leemy.ta3leemy_teacher_app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import android.view.WindowManager.LayoutParams

class MainActivity: FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // 🔒 SECURITY LAYER: منع السكرين شوت
        window.setFlags(
            LayoutParams.FLAG_SECURE, 
            LayoutParams.FLAG_SECURE
        )
    }
}
