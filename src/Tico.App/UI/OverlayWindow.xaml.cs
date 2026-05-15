using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media.Animation;

namespace Tico.App.UI;

public partial class OverlayWindow : Window
{
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TRANSPARENT = 0x00000020;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hwnd, int index);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

    public OverlayWindow()
    {
        InitializeComponent();

        var screen = System.Windows.Forms.Screen.PrimaryScreen!;
        Width = screen.Bounds.Width;
        Height = screen.Bounds.Height;
        Left = screen.Bounds.Left;
        Top = screen.Bounds.Top;

        SourceInitialized += OnSourceInitialized;
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        int exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetWindowLong(hwnd, GWL_EXSTYLE, exStyle | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW);
    }

    public void ShowGlowAt(int screenX, int screenY)
    {
        // Glow underline disabled — the buddy hovering above the element
        // is sufficient visual indication, and the underline was covering
        // clickable elements of varying sizes.
        Show();
    }

    public void DismissWithFade()
    {
        GlowUnderline.BeginAnimation(OpacityProperty, null);
        GlowUnderline.Visibility = Visibility.Collapsed;

        var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(300));
        fadeOut.Completed += (_, _) =>
        {
            Hide();
            Opacity = 1;
        };
        BeginAnimation(OpacityProperty, fadeOut);
    }
}
