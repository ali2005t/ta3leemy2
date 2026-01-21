import 'package:flutter/material.dart';
import 'package:webview_windows/webview_windows.dart';
import 'config.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  final _controller = WebviewController();
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    initWebview();
  }

  Future<void> initWebview() async {
    try {
      await _controller.initialize();
      
      // 🕵️‍♂️ User Agent مخصص عشان نعرف إنه برنامج كمبيوتر
      await _controller.setUserAgent("${AppConfig.appName}/1.0 (Windows Desktop)");
      
      await _controller.loadUrl(AppConfig.startUrl);

      // الاستماع لتغيير الرابط (عشان لو حب يفتح لينك خارجي)
      _controller.url.listen((url) {
        // ممكن نضيف منطق هنا لفتح لينكات معينة في المتصفح الخارجي
      });

      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
    } catch (e) {
      print("Error initializing WebView: $e");
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          // 🏮 القائمة الجانبية (Sidebar)
          Container(
            width: 70,
            color: const Color(0xFF1E293B), // Slate 800
            child: Column(
              children: [
                const SizedBox(height: 20),
                // Logo or Icon
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: AppConfig.primaryColor,
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Icon(Icons.school, color: Colors.white, size: 30),
                ),
                const SizedBox(height: 40),
                
                // Actions
                _SideButton(
                    icon: Icons.home_rounded,
                    label: "Home",
                    onTap: () => _controller.loadUrl(AppConfig.startUrl)
                ),
                const SizedBox(height: 20),
                _SideButton(
                    icon: Icons.refresh_rounded,
                    label: "Refresh",
                    onTap: () => _controller.reload()
                ),
                const Spacer(),
                const Padding(
                  padding: EdgeInsets.only(bottom: 20),
                  child: RotatedBox(
                    quarterTurns: 3,
                    child: Text(
                      "Ta3leemy App",
                      style: TextStyle(color: Colors.white24, letterSpacing: 2),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // 🕸️ مستعرض الموقع (WebView)
          Expanded(
            child: Container(
              color: const Color(0xFF0F172A),
              child: _isInitialized
                  ? Padding(
                      padding: const EdgeInsets.only(top: 0), // No padding needed if borderless
                      child: Webview(
                          _controller,
                          permissionRequested: _onPermissionRequested,
                        ),
                    )
                  : Center(
                      child: CircularProgressIndicator(color: AppConfig.primaryColor),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Future<WebviewPermissionDecision> _onPermissionRequested(
      String url, WebviewPermissionKind kind, bool isUserInitiated) async {
    final decision = await showDialog<WebviewPermissionDecision>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('طلب إذن', style: TextStyle(color: Colors.white)),
        content: Text('الموقع يطلب إذن: $kind\nهل توافق؟', style: const TextStyle(color: Colors.white70)),
        actions: <Widget>[
          TextButton(
            onPressed: () =>
                Navigator.pop(context, WebviewPermissionDecision.deny),
            child: const Text('رفض', style: TextStyle(color: Colors.redAccent)),
          ),
          TextButton(
            onPressed: () =>
                Navigator.pop(context, WebviewPermissionDecision.allow),
            child: const Text('سماح'),
          ),
        ],
      ),
    );

    return decision ?? WebviewPermissionDecision.deny;
  }
}

class _SideButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _SideButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(icon, color: Colors.white70),
      tooltip: label,
      onPressed: onTap,
      hoverColor: Colors.white10,
      splashRadius: 25,
    );
  }
}
