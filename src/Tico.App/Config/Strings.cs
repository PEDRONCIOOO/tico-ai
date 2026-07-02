using System.Globalization;

namespace Tico.App.Config;

public static class Strings
{
    private static readonly string Lang = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
    private static bool IsPt => Lang == "pt";

    // Settings panel
    public static string Account => IsPt ? "CONTA" : "ACCOUNT";
    public static string Usage => IsPt ? "uso" : "usage";
    public static string UnlimitedUsage => IsPt ? "uso ilimitado" : "unlimited usage";
    public static string UsesOf => IsPt ? "de" : "of";
    public static string Uses => IsPt ? "usos" : "uses";
    public static string RemainingToday => IsPt ? "restantes • hoje" : "remaining • today";
    public static string RemainingMonth => IsPt ? "restantes • este mês" : "remaining • this month";
    public static string Logout => IsPt ? "sair da conta" : "log out";
    public static string HotkeyTip => IsPt ? "pressione e segure {0} para falar com o tico" : "press and hold {0} to talk to tico";
    public static string Model => IsPt ? "Modelo" : "Model";
    public static string Voice => IsPt ? "Voz" : "Voice";
    public static string Microphone => IsPt ? "Microfone" : "Microphone";
    public static string MicDefault => IsPt ? "Padrão do sistema" : "System default";
    public static string Appearance => IsPt ? "Aparência" : "Appearance";
    public static string StyleDefault => IsPt ? "Bolinha" : "Blob";
    public static string StyleCursor => IsPt ? "Ponteiro" : "Pointer";
    public static string ShowTico => IsPt ? "Mostrar Tico" : "Show Tico";
    public static string ChatHistory => IsPt ? "Histórico de chat" : "Chat history";
    public static string Hotkey => IsPt ? "Tecla" : "Hotkey";
    public static string PressKey => IsPt ? "aperte uma tecla..." : "press a key...";
    public static string AppVersion => "tico v1.0.0  ·  ticoai.app";

    // Tray
    public static string TrayReady => IsPt ? "Tico — Pronto" : "Tico — Ready";
    public static string TrayRecording => IsPt ? "Tico — Gravando..." : "Tico — Recording...";
    public static string TrayProcessing => IsPt ? "Tico — Pensando..." : "Tico — Thinking...";
    public static string TraySpeaking => IsPt ? "Tico — Falando..." : "Tico — Speaking...";
    public static string TraySettings => IsPt ? "Configurações" : "Settings";
    public static string TrayQuit => IsPt ? "Sair" : "Quit";

    // Tier names
    public static string TierName(string tier) => tier switch
    {
        "free" => IsPt ? "GRÁTIS" : "FREE",
        "pro" => "PRO",
        "unlimited" => IsPt ? "ILIMITADO" : "UNLIMITED",
        _ => tier.ToUpperInvariant()
    };

    // Login
    public static string AlreadyRunning => IsPt ? "Tico já está rodando." : "Tico is already running.";
    public static string SessionExpired => IsPt ? "Sessão encerrada. Abra o Tico novamente para entrar." : "Session ended. Open Tico again to log in.";
    public static string StartupError => IsPt ? "Erro ao iniciar Tico" : "Error starting Tico";

    // Update
    public static string UpdateAvailable(string version) => IsPt
        ? $"nova versão {version} disponível!"
        : $"new version {version} available!";
    public static string UpdateNotifTitle => IsPt ? "Tico — Atualização disponível" : "Tico — Update available";
    public static string UpdateNotifBody(string version) => IsPt
        ? $"Versão {version} disponível. Clique para baixar."
        : $"Version {version} available. Click to download.";

    // Chat history
    public static string NoChatYet => IsPt
        ? "nenhuma conversa ainda.\npressione F8 para falar com o tico."
        : "no conversations yet.\npress F8 to talk to tico.";
}
