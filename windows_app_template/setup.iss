; =====================================================================
; 💿 ملف إعداد التثبيت (Setup Script)
; =====================================================================
; هذا الملف يستخدم مع برنامج Inno Setup لعمل ملف exe واحد يسطب البرنامج.
;
; 1. حمل برنامج Inno Setup من هنا: https://jrsoftware.org/isdl.php
; 2. افتح هذا الملف ببرنامج Inno Setup.
; 3. عدل القيم تحت قسم [Setup] كما هو مشروح.
; 4. اضغط زر Play (Run) لإنشاء ملف التثبيت.
; =====================================================================

[Setup]
; ✏️ اسم برنامجك (يظهر للمستخدم)
AppName=hossamsaid
; ✏️ رقم الإصدار
AppVersion=1.0
; ✏️ اسم الشركة أو الناشر
AppPublisher=hossamsaid
; ✏️ موقعك الإلكتروني
AppPublisherURL=https://smmviip.com
; ⚠️ لا تغير هذا السطر (مكان تثبيت البرنامج عند المستخدم)
DefaultDirName={autopf}\hossamsaid
; ⚠️ لا تغير هذا السطر
DefaultGroupName=hossamsaid
; 📂 مكان حفظ ملف الـ Setup الناتج (سيظهر بجوار هذا الملف)
OutputDir=.
; 📝 اسم ملف الـ Setup الناتج
OutputBaseFilename=hossamsaid_Setup_v1.0
; ضغط الملفات (جودة عالية)
Compression=lzma
SolidCompression=yes
; يطلب صلاحيات الأدمن للتثبيت
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; ⚠️ تأكد أنك قمت بعمل Build Windows أولاً قبل تشغيل هذا الملف!
; هذا الأمر يأخذ ملفات البرنامج من مجلد الـ Build
Source: "build\windows\x64\runner\Release\sera.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\hossamsaid"; Filename: "{app}\sera.exe"
Name: "{commondesktop}\hossamsaid"; Filename: "{app}\sera.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\sera.exe"; Description: "{cm:LaunchProgram,hossamsaid}"; Flags: nowait postinstall skipifsilent
