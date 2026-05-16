using System.Windows;
using System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;

namespace Tico.App.UI;

public partial class ChatHistoryButton : Window
{
    public event Action? Clicked;
    public event Action? PauseClicked;

    private bool _isPaused;
    private int _unreadCount;

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
        // Reset counter when user opens history
        _unreadCount = 0;
        CountBadge.Visibility = Visibility.Collapsed;
        Clicked?.Invoke();
    }

    private void OnMuteClick(object sender, MouseButtonEventArgs e)
    {
        _isPaused = !_isPaused;
        MuteIcon.Text = _isPaused ? "\u23F8" : "\U0001F50A";
        MuteBorder.BorderBrush = _isPaused
            ? new SolidColorBrush(System.Windows.Media.Color.FromRgb(239, 68, 68))
            : new SolidColorBrush(System.Windows.Media.Color.FromRgb(51, 51, 51));
        PauseClicked?.Invoke();
    }

    public bool IsPaused => _isPaused;

    public void ResetPause()
    {
        _isPaused = false;
        MuteIcon.Text = "\U0001F50A";
        MuteBorder.BorderBrush = new SolidColorBrush(System.Windows.Media.Color.FromRgb(51, 51, 51));
    }

    public void IncrementCount()
    {
        _unreadCount++;
        CountText.Text = _unreadCount > 99 ? "99+" : _unreadCount.ToString();
        CountBadge.Visibility = Visibility.Visible;

        // Pulse animation on badge
        var scale = new ScaleTransform(1, 1);
        CountBadge.RenderTransform = scale;
        CountBadge.RenderTransformOrigin = new System.Windows.Point(0.5, 0.5);
        var pulse = new DoubleAnimation(1.3, 1.0, TimeSpan.FromMilliseconds(300))
        {
            EasingFunction = new ElasticEase { Oscillations = 1, Springiness = 8 }
        };
        scale.BeginAnimation(ScaleTransform.ScaleXProperty, pulse);
        scale.BeginAnimation(ScaleTransform.ScaleYProperty, pulse);
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
