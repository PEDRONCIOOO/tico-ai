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
            CompanionState.Idle => (Color.FromArgb(124, 58, 237), "Tico — Pronto"),
            CompanionState.Recording => (Color.FromArgb(239, 68, 68), "Tico — Gravando..."),
            CompanionState.Processing => (Color.FromArgb(245, 158, 11), "Tico — Pensando..."),
            CompanionState.Speaking => (Color.FromArgb(16, 185, 129), "Tico — Falando..."),
            _ => (Color.FromArgb(124, 58, 237), "Tico")
        };
        _trayIcon.Icon = CreateColoredIcon(color);
        _trayIcon.ToolTipText = tooltip;
    }

    private System.Windows.Controls.ContextMenu CreateContextMenu()
    {
        var menu = new System.Windows.Controls.ContextMenu();
        var settingsItem = new System.Windows.Controls.MenuItem { Header = "Configurações" };
        settingsItem.Click += (_, _) => SettingsRequested?.Invoke();
        menu.Items.Add(settingsItem);
        menu.Items.Add(new System.Windows.Controls.Separator());
        var quitItem = new System.Windows.Controls.MenuItem { Header = "Sair" };
        quitItem.Click += (_, _) => QuitRequested?.Invoke();
        menu.Items.Add(quitItem);
        return menu;
    }

    private static Icon CreateColoredIcon(Color color)
    {
        var bmp = new Bitmap(16, 16);
        using var g = Graphics.FromImage(bmp);
        using var brush = new SolidBrush(color);
        g.FillRectangle(brush, 0, 0, 16, 16);
        using var font = new Font("Segoe UI", 9, System.Drawing.FontStyle.Bold);
        using var textBrush = new SolidBrush(Color.White);
        g.DrawString("T", font, textBrush, 1, 0);
        return Icon.FromHandle(bmp.GetHicon());
    }

    public void Dispose()
    {
        _trayIcon.Dispose();
        GC.SuppressFinalize(this);
    }
}
