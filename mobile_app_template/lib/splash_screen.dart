import 'package:flutter/material.dart';
import 'webview_screen.dart';
import 'config.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // ⏳ الانتظار 3 ثواني ثم الانتقال للمتصفح
    Future.delayed(const Duration(seconds: 3), () {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const WebViewScreen()),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            
            // 🖼️ 1. اللوجو (Logo)
            // يتأكد الأول لو فيه صورة، لو مفيش يعرض أيقونة
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Image.asset(
                AppConfig.logoAssetPath, // مسار الصورة من الكونفيج
                height: 120, 
                errorBuilder: (c, e, s) => const Icon(Icons.school, size: 100, color: AppConfig.primaryColor),
              ),
            ),

            const SizedBox(height: 20),

            // 📝 2. اسم التطبيق (App Name)
            Text(
              AppConfig.appName,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),

            const SizedBox(height: 20),
            
            // 🔄 دائرة تحميل صغيرة
            const CircularProgressIndicator(
              color: AppConfig.primaryColor,
            ),

            const Spacer(),

            // 🏗️ 3. حقوق التطوير (Bottom Footer)
            Padding(
              padding: const EdgeInsets.only(bottom: 30),
              child: Column(
                children: [
                   Text(
                    "Developed by",
                    style: TextStyle(
                      color: Colors.grey[500],
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 5),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.code, size: 16, color: AppConfig.primaryColor),
                      SizedBox(width: 5),
                      Text(
                        "Ta3leemy",
                        style: TextStyle(
                          color: AppConfig.primaryColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  )
                ],
              ),
            )
          ],
        ),
      ),
    );
  }
}
