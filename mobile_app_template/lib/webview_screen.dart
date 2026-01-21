import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'config.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  // للتحكم في المتصفح
  InAppWebViewController? webViewController;
  
  // حالة التحميل
  double progress = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      // SafeArea: عشان المحتوى ميدكخلش في "النوتش" أو شريط الحالة
      body: SafeArea(
        child: Stack(
          children: [
            
            // 🌐 1. المتصفح (The WebView)
            InAppWebView(
              initialUrlRequest: URLRequest(url: WebUri(AppConfig.startUrl)),
              
              initialSettings: InAppWebViewSettings(
                // ✅ السماح بالجافاسكريبت (مهم جداً)
                javaScriptEnabled: true,
                
                // ✅ التخزين المحلي (عشان "تذكرني" تشتغل) | Local Storage
                domStorageEnabled: true,
                databaseEnabled: true,
                
                // ✅ الكوكيز (مهم جداً لحفظ الجلسة)
                thirdPartyCookiesEnabled: true,
                cacheEnabled: true,
                clearCache: false,
                clearSessionCache: false,


                // ✅ منع التكبير/التصغير اليدوي (للحفاظ على شكل التطبيق)
                supportZoom: false,
                
                // ✅ إعدادات الميديا (عشان رفع الملفات والفيديوهات)
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserGesture: false,

                // ✅ User Agent المخصص
                userAgent: AppConfig.userAgent,
              ),

              // عند إنشاء المتصفح
              onWebViewCreated: (controller) {
                webViewController = controller;
              },

              // عند تحديث شريط التحميل
              onProgressChanged: (controller, p) {
                setState(() {
                  progress = p / 100;
                });
              },

              // 🔗 التعامل مع الروابط الخارجية (مثل واتساب)
              shouldOverrideUrlLoading: (controller, navigationAction) async {
                var uri = navigationAction.request.url!;

                // قائمة البروتوكولات الخارجية المسموح بها
                if (!["http", "https", "file", "chrome", "data", "javascript", "about"]
                    .contains(uri.scheme)) {
                  // محاولة فتح الرابط في تطبيق خارجي (مثل WhatsApp, Tel, Mailto)
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri);
                    return NavigationActionPolicy.CANCEL;
                  }
                }

                return NavigationActionPolicy.ALLOW;
              },
              
              // التعامل مع أخطاء التحميل
              onReceivedError: (controller, request, error) {
                // يمكن إضافة صفحة "لا يوجد اتصال" مخصصة هنا
              },
            ),

            // ⏳ 2. شريط التحميل (Progress Bar)
            if (progress < 1.0)
              LinearProgressIndicator(
                value: progress,
                color: AppConfig.primaryColor,
                backgroundColor: Colors.transparent,
                minHeight: 3,
              ),
          ],
        ),
      ),
    );
  }
}
