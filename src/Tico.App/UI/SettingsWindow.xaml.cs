using System.Drawing;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using Tico.App.Config;
using Tico.App.Services;
using WpfBrushes = System.Windows.Media.Brushes;
using WpfColor = System.Windows.Media.Color;
using WpfSolidBrush = System.Windows.Media.SolidColorBrush;
using S = Tico.App.Config.Strings;

namespace Tico.App.UI;

public partial class SettingsWindow : Window
{
    private readonly AppSettings _settings;
    private readonly Session _session;
    private readonly IProxyClient _proxy;
    private bool _forceClose;
    private bool _waitingForHotkey;

    public event Action<bool>? BuddyVisibilityChanged;
    public event Action<string>? ModelChanged;
    public event Action<string>? VoiceChanged;
    public event Action? LogoutRequested;
    public event Action<bool>? ChatHistoryVisibilityChanged;
    public event Action<string>? HotkeyChanged;

    public SettingsWindow(AppSettings settings, Session session, IProxyClient proxy)
    {
        InitializeComponent();
        _settings = settings;
        _session = session;
        _proxy = proxy;

        Icon = CreateTicoIcon();
        Title = "Tico";

        MouseLeftButtonDown += (_, _) => DragMove();

        Closing += (_, e) =>
        {
            if (!_forceClose)
            {
                e.Cancel = true;
                WindowState = WindowState.Minimized;
            }
        };

        StateChanged += async (_, _) =>
        {
            if (WindowState == WindowState.Normal)
                await LoadAccountAsync();
        };

        // Hotkey capture
        PreviewKeyDown += OnPreviewKeyDown;

        LoadSettings();
        ApplyStrings();
        Loaded += async (_, _) => await LoadAccountAsync();
    }

    public void ForceClose()
    {
        _forceClose = true;
        Close();
    }

    public void ShowFromTaskbar()
    {
        WindowState = WindowState.Normal;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Activate();
    }

    private void ApplyStrings()
    {
        AccountLabel.Text = S.Account;
        LogoutText.Text = S.Logout;
        HotkeyTipText.Text = string.Format(S.HotkeyTip, _settings.HotkeyCombo);
        HotkeyLabel.Text = S.Hotkey;
        HotkeyButton.Content = _settings.HotkeyCombo;
        ModelLabel.Text = S.Model;
        VoiceLabel.Text = S.Voice;
        ShowTicoLabel.Text = S.ShowTico;
        ChatHistoryLabel.Text = S.ChatHistory;
    }

    private static System.Windows.Media.ImageSource CreateTicoIcon()
    {
        const int size = 256;
        var bmp = new Bitmap(size, size);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;

        using var brush = new SolidBrush(Color.FromArgb(124, 58, 237));
        g.FillEllipse(brush, 8, 8, size - 16, size - 16);

        using var white = new SolidBrush(Color.White);
        int eyeSize = size / 8;
        int eyeY = (int)(size * 0.42);
        g.FillEllipse(white, (int)(size * 0.33), eyeY, eyeSize, eyeSize);
        g.FillEllipse(white, (int)(size * 0.55), eyeY, eyeSize, eyeSize);

        var hIcon = bmp.GetHicon();
        return Imaging.CreateBitmapSourceFromHIcon(hIcon, Int32Rect.Empty,
            System.Windows.Media.Imaging.BitmapSizeOptions.FromEmptyOptions());
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
        UsageText.Text = "...";

        try
        {
            var usage = await _proxy.GetUsageAsync();
            ApplyUsage(usage);
        }
        catch
        {
            UsageText.Text = "—";
            UsageRemainingText.Text = "";
        }
    }

    private void ApplyUsage(UsageInfo usage)
    {
        TierText.Text = S.TierName(usage.Tier);

        if (usage.Limit < 0)
        {
            UsageText.Text = S.UnlimitedUsage;
            UsageRemainingText.Text = "";
            UsageBar.Width = 272;
        }
        else
        {
            UsageText.Text = $"{usage.Used} {S.UsesOf} {usage.Limit} {S.Uses}";
            UsageRemainingText.Text = $"{usage.Remaining} {(usage.Tier == "free" ? S.RemainingToday : S.RemainingMonth)}";

            var fraction = usage.Limit > 0 ? Math.Clamp((double)usage.Used / usage.Limit, 0, 1) : 0;
            UsageBar.Width = 272 * fraction;

            if (fraction >= 0.8)
                UsageBar.Background = new WpfSolidBrush(WpfColor.FromRgb(239, 68, 68));
        }
    }

    // --- Hotkey binding ---

    private void OnHotkeyClick(object sender, RoutedEventArgs e)
    {
        _waitingForHotkey = true;
        HotkeyButton.Content = S.PressKey;
        HotkeyButton.BorderBrush = new WpfSolidBrush(WpfColor.FromRgb(239, 68, 68));
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (!_waitingForHotkey) return;

        e.Handled = true;
        _waitingForHotkey = false;

        // Get the actual key (not system key wrapper)
        var key = e.Key == Key.System ? e.SystemKey : e.Key;

        // Ignore lone modifiers
        if (key is Key.LeftCtrl or Key.RightCtrl or Key.LeftShift or Key.RightShift
            or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin)
            return;

        // Build combo string
        var parts = new List<string>();
        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Control)) parts.Add("Ctrl");
        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Shift)) parts.Add("Shift");
        if (Keyboard.Modifiers.HasFlag(ModifierKeys.Alt)) parts.Add("Alt");
        parts.Add(key.ToString());

        var combo = string.Join("+", parts);

        _settings.HotkeyCombo = combo;
        _settings.SaveTo(AppSettings.DefaultPath);

        HotkeyButton.Content = combo;
        HotkeyButton.BorderBrush = new WpfSolidBrush(WpfColor.FromRgb(124, 58, 237));
        HotkeyTipText.Text = string.Format(S.HotkeyTip, combo);

        HotkeyChanged?.Invoke(combo);
    }

    // --- Model ---

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

    // --- Toggles ---

    private void OnBuddyToggleChanged(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded) return;
        BuddyVisibilityChanged?.Invoke(ShowBuddyToggle.IsChecked ?? true);
    }

    private void OnChatHistoryToggleChanged(object sender, RoutedEventArgs e)
    {
        if (!IsLoaded) return;
        var enabled = ChatHistoryToggle.IsChecked ?? true;
        _settings.ChatHistoryEnabled = enabled;
        _settings.SaveTo(AppSettings.DefaultPath);
        ChatHistoryVisibilityChanged?.Invoke(enabled);
    }

    // --- Actions ---

    private void OnLogout(object sender, RoutedEventArgs e)
    {
        LogoutRequested?.Invoke();
        ForceClose();
    }

    private void OnClose(object sender, RoutedEventArgs e)
    {
        var selectedVoice = (VoiceCombo.SelectedItem as ComboBoxItem)?.Tag?.ToString();
        if (selectedVoice != null && selectedVoice != _settings.TtsVoice)
        {
            _settings.TtsVoice = selectedVoice;
            _settings.SaveTo(AppSettings.DefaultPath);
            VoiceChanged?.Invoke(_settings.TtsVoice);
        }

        WindowState = WindowState.Minimized;
    }
}
