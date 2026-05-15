using System.Windows;
using System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Media.Animation;

namespace Tico.App.UI;

public partial class ChatHistoryButton : Window
{
    public event Action? Clicked;

    public ChatHistoryButton()
    {
        InitializeComponent();
        PositionAtTopCenter();
    }

    private void PositionAtTopCenter()
    {
        var screen = Screen.PrimaryScreen!;
        Left = screen.WorkingArea.Left + (screen.WorkingArea.Width - Width) / 2;
        Top = screen.WorkingArea.Top + 8;
    }

    private void OnClick(object sender, MouseButtonEventArgs e)
    {
        Clicked?.Invoke();
    }

    public void ShowWithFade()
    {
        if (IsVisible) return;
        Opacity = 0;
        Show();
        var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(300));
        BeginAnimation(OpacityProperty, fadeIn);
    }

    public void HideWithFade()
    {
        if (!IsVisible) return;
        var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(200));
        fadeOut.Completed += (_, _) => Hide();
        BeginAnimation(OpacityProperty, fadeOut);
    }
}
