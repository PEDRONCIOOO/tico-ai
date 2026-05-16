[Setup]
AppName=Tico
AppVersion=1.0.0
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

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\Tico"; Filename: "{app}\Tico.App.exe"
Name: "{autodesktop}\Tico"; Filename: "{app}\Tico.App.exe"; Tasks: desktopicon
Name: "{autostartup}\Tico"; Filename: "{app}\Tico.App.exe"; Tasks: startup

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na area de trabalho"; GroupDescription: "Atalhos:"
Name: "startup"; Description: "Iniciar com o Windows"; GroupDescription: "Opcoes:"

[Run]
Filename: "{app}\Tico.App.exe"; Description: "Abrir Tico"; Flags: nowait postinstall skipifsilent
