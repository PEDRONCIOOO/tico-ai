using System.Windows;
using System.Windows.Controls;
using Tico.App.Config;
using Tico.App.Services;
using WpfBrushes = System.Windows.Media.Brushes;
using WpfColor = System.Windows.Media.Color;
using WpfSolidBrush = System.Windows.Media.SolidColorBrush;

namespace Tico.App.UI;

public partial class SettingsWindow : Window
{
    private readonly AppSettings _settings;
    private readonly Session _session;
    private readonly IProxyClient _proxy;

    public event Action<bool>? BuddyVisibilityChanged;
    public event Action<string>? ModelChanged;
    public event Action<string>? VoiceChanged;
    public event Action? LogoutRequested;
    public event Action<bool>? ChatHistoryVisibilityChanged;

    public SettingsWindow(AppSettings settings, Session session, IProxyClient proxy)
    {
        InitializeComponent();
        _settings = settings;
        _session = session;
        _proxy = proxy;

        // Allow dragging
        MouseLeftButtonDown += (_, _) => DragMove();

        LoadSettings();
        Loaded += async (_, _) => await LoadAccountAsync();
    }

    private void LoadSettings()
    {
        UpdateModelButtons(_settings.ClaudeModel);

        foreach (ComboBoxItem item in VoiceCombo.Items)
        {
            if (item.Tag?.ToString() == _settings.TtsVoice)
            {
                VoiceCombo.SelectedItem = item;
                break;
            }
        }

        ChatHistoryToggle.IsChecked = _settings.ChatHistoryEnabled;
    }

    private async Task LoadAccountAsync()
    {
        EmailText.Text = _session.Email;
        TierText.Text = "...";
        UsageText.Text = "carregando uso...";

        try
        {
            var usage = await _proxy.GetUsageAsync();
            ApplyUsage(usage);
        }
        catch (Exception ex)
        {
            UsageText.Text = "erro ao carregar uso";
            UsageRemainingText.Text = "";
            System.Diagnostics.Debug.WriteLine($"GetUsage failed: {ex.Message}");
        }
    }

    private void ApplyUsage(UsageInfo usage)
    {
        var tierLabel = usage.Tier switch
        {
            "free" => "GRÁTIS",
            "pro" => "PRO",
            "unlimited" => "ILIMITADO",
            _ => usage.Tier.ToUpperInvariant()
        };
        TierText.Text = tierLabel;

        if (usage.Limit < 0)
        {
            UsageText.Text = "uso ilimitado";
            UsageRemainingText.Text = "";
            UsageBar.Width = 200;
        }
        else
        {
            UsageText.Text = $"{usage.Used} de {usage.Limit} usos";
            var period = usage.Tier == "free" ? "hoje" : "este mês";
            UsageRemainingText.Text = $"{usage.Remaining} restantes • {period}";

            // Bar fill (the parent border is ~272px wide; recompute proportionally)
            var fraction = usage.Limit > 0 ? Math.Clamp((double)usage.Used / usage.Limit, 0, 1) : 0;
            UsageBar.Width = 272 * fraction;

            // Tint red as user gets close to limit
            if (fraction >= 0.8)
                UsageBar.Background = new WpfSolidBrush(WpfColor.FromRgb(239, 68, 68));
        }
    }

    private void UpdateModelButtons(string modelId)
    {
        bool isSonnet = modelId.Contains("sonnet");

        BtnSonnet.Foreground = new WpfSolidBrush(isSonnet
            ? WpfColor.FromRgb(236, 238, 237)
            : WpfColor.FromRgb(107, 115, 111));
        BtnSonnet.Background = isSonnet
            ? new WpfSolidBrush(WpfColor.FromArgb(26, 255, 255, 255))
            : WpfBrushes.Transparent;

        BtnOpus.Foreground = new WpfSolidBrush(!isSonnet
            ? WpfColor.FromRgb(236, 238, 237)
            : WpfColor.FromRgb(107, 115, 111));
        BtnOpus.Background = !isSonnet
            ? new WpfSolidBrush(WpfColor.FromArgb(26, 255, 255, 255))
            : WpfBrushes.Transparent;
    }

    private void OnSelectSonnet(object sender, RoutedEventArgs e)
    {
        _settings.ClaudeModel = "claude-sonnet-4-6";
        UpdateModelButtons(_settings.ClaudeModel);
        _settings.SaveTo(AppSettings.DefaultPath);
        ModelChanged?.Invoke(_settings.ClaudeModel);
    }

    private void OnSelectOpus(object sender, RoutedEventArgs e)
    {
        _settings.ClaudeModel = "claude-opus-4-6";
        UpdateModelButtons(_settings.ClaudeModel);
        _settings.SaveTo(AppSettings.DefaultPath);
        ModelChanged?.Invoke(_settings.ClaudeModel);
    }

    private void OnBuddyToggleChanged(object sender, RoutedEventArgs e)
    {
        BuddyVisibilityChanged?.Invoke(ShowBuddyToggle.IsChecked ?? true);
    }

    private void OnChatHistoryToggleChanged(object sender, RoutedEventArgs e)
    {
        var enabled = ChatHistoryToggle.IsChecked ?? true;
        _settings.ChatHistoryEnabled = enabled;
        _settings.SaveTo(AppSettings.DefaultPath);
        ChatHistoryVisibilityChanged?.Invoke(enabled);
    }

    private void OnLogout(object sender, RoutedEventArgs e)
    {
        LogoutRequested?.Invoke();
        Close();
    }

    private void OnClose(object sender, RoutedEventArgs e)
    {
        // Save voice on close
        var selectedVoice = (VoiceCombo.SelectedItem as ComboBoxItem)?.Tag?.ToString();
        if (selectedVoice != null && selectedVoice != _settings.TtsVoice)
        {
            _settings.TtsVoice = selectedVoice;
            _settings.SaveTo(AppSettings.DefaultPath);
            VoiceChanged?.Invoke(_settings.TtsVoice);
        }

        Close();
    }
}
