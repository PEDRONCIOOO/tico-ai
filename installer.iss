[Setup]
AppName=Tico
AppVersion=1.1.0
AppPublisher=TicoAI
AppPublisherURL=https://ticoai.app
DefaultDirName={autopf}\Tico
DefaultGroupName=Tico
OutputDir=.\output
OutputBaseFilename=TicoSetup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
SetupIconFile=src\Tico.App\tico.ico
UninstallDisplayIcon={app}\Tico.App.exe
WizardStyle=modern
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[CustomMessages]
english.ShortcutsGroup=Shortcuts:
english.DesktopIcon=Create a desktop shortcut
english.OptionsGroup=Options:
english.StartWithWindows=Start with Windows
english.OpenTico=Open Tico

brazilianportuguese.ShortcutsGroup=Atalhos:
brazilianportuguese.DesktopIcon=Criar atalho na area de trabalho
brazilianportuguese.OptionsGroup=Opcoes:
brazilianportuguese.StartWithWindows=Iniciar com o Windows
brazilianportuguese.OpenTico=Abrir Tico

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\Tico"; Filename: "{app}\Tico.App.exe"
Name: "{autodesktop}\Tico"; Filename: "{app}\Tico.App.exe"; Tasks: desktopicon
Name: "{autostartup}\Tico"; Filename: "{app}\Tico.App.exe"; Tasks: startup

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:ShortcutsGroup}"
Name: "startup"; Description: "{cm:StartWithWindows}"; GroupDescription: "{cm:OptionsGroup}"

[Run]
Filename: "{app}\Tico.App.exe"; Description: "{cm:OpenTico}"; Flags: nowait postinstall skipifsilent
