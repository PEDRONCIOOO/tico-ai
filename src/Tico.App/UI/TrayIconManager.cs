using System.Drawing;
using System.Windows;
using System.Windows.Forms;
using Hardcodet.Wpf.TaskbarNotification;
using Tico.App.Core;

namespace Tico.App.UI;

public class TrayIconManager : IDisposable
{
    private readonly TaskbarIcon _trayIcon;

    public event Action? SettingsRequested;
    public event Action? QuitRequested;

    public TrayIconManager()
    {
        _trayIcon = new TaskbarIcon
        {
            Icon = CreateColoredIcon(Color.FromArgb(124, 58, 237)),
            ToolTipText = "Tico — Pronto",
            ContextMenu = CreateContextMenu()
        };
    }

    public void UpdateState(CompanionState state)
    {
        var (color, tooltip) = state switch
        {
            CompanionState.Idle => (Color.FromArgb(124, 58, 237), Config.Strings.TrayReady),
            CompanionState.Recording => (Color.FromArgb(239, 68, 68), Config.Strings.TrayRecording),
            CompanionState.Processing => (Color.FromArgb(245, 158, 11), Config.Strings.TrayProcessing),
            CompanionState.Speaking => (Color.FromArgb(16, 185, 129), Config.Strings.TraySpeaking),
            _ => (Color.FromArgb(124, 58, 237), "Tico")
        };
        _trayIcon.Icon = CreateColoredIcon(color);
        _trayIcon.ToolTipText = tooltip;
    }

    private System.Windows.Controls.ContextMenu CreateContextMenu()
    {
        var menu = new System.Windows.Controls.ContextMenu();
        var settingsItem = new System.Windows.Controls.MenuItem { Header = Config.Strings.TraySettings };
        settingsItem.Click += (_, _) => SettingsRequested?.Invoke();
        menu.Items.Add(settingsItem);
        menu.Items.Add(new System.Windows.Controls.Separator());
        var quitItem = new System.Windows.Controls.MenuItem { Header = Config.Strings.TrayQuit };
        quitItem.Click += (_, _) => QuitRequested?.Invoke();
        menu.Items.Add(quitItem);
        return menu;
    }

    private static Icon CreateColoredIcon(Color color)
    {
        const int size = 64;
        var bmp = new Bitmap(size, size);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;

        using var brush = new SolidBrush(color);
        g.FillEllipse(brush, 2, 2, size - 4, size - 4);

        using var white = new SolidBrush(Color.White);
        int eyeSize = size / 7;
        int eyeY = (int)(size * 0.40);
        g.FillEllipse(white, (int)(size * 0.30), eyeY, eyeSize, eyeSize);
        g.FillEllipse(white, (int)(size * 0.55), eyeY, eyeSize, eyeSize);

        return Icon.FromHandle(bmp.GetHicon());
    }

    public void ShowUpdateNotification(string version, string url)
    {
        _trayIcon.TrayBalloonTipClicked += OnUpdateBalloonClicked;
        _trayIcon.Tag = url;
        _trayIcon.ShowBalloonTip(
            "Tico — Atualização disponível",
            $"Versão {version} disponível. Clique para baixar.",
            BalloonIcon.Info);
    }

    private void OnUpdateBalloonClicked(object? sender, RoutedEventArgs e)
    {
        _trayIcon.TrayBalloonTipClicked -= OnUpdateBalloonClicked;
        if (_trayIcon.Tag is string url)
            Services.UpdateChecker.OpenDownloadPage(url);
    }

    public void Dispose()
    {
        _trayIcon.Dispose();
        GC.SuppressFinalize(this);
    }
}
