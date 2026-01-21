package com.example.ta3leemy_teacher

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import android.view.WindowManager.LayoutParams

class MainActivity: FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        // 🔒 SECURITY LAYER: منع السكرين شوت (Anti-Screenshot)
        // هذا الكود يمنع تصوير الشاشة في التطبيق بالكامل
        window.setFlags(
            LayoutParams.FLAG_SECURE, 
            LayoutParams.FLAG_SECURE
        )
    }
}
