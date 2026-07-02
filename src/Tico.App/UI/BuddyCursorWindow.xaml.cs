using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Forms;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using Rectangle = System.Windows.Shapes.Rectangle;
using System.Windows.Threading;
using Tico.App.Core;
using Color = System.Windows.Media.Color;

namespace Tico.App.UI;

public partial class BuddyCursorWindow : Window
{
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TRANSPARENT = 0x00000020;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int WS_EX_NOACTIVATE = 0x08000000;

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hwnd, int index);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hwnd, int index, int newStyle);

    [DllImport("user32.dll")]
    private static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    // Position state
    private double _buddyX, _buddyY;
    private double _velocityX, _velocityY;
    private double _targetX, _targetY;

    // Spring physics constants (matching Clicky: response 0.2, damping 0.6)
    private const double SpringStiffness = 250.0;  // ~(2pi/0.2)^2
    private const double SpringDamping = 18.0;      // 2 * 0.6 * sqrt(250)
    private const double OffsetX = 35.0;
    private const double OffsetY = 25.0;

    // When flying to a pointed element, land exactly on target (like Clicky)
    private const double PointOffsetX = 0.0;
    private const double PointOffsetY = 0.0;

    // Flight animation
    private bool _isFlying;
    private double _flightProgress;
    private double _flightDuration;
    private double _flightStartX, _flightStartY;
    private double _flightEndX, _flightEndY;
    private double _flightControlX, _flightControlY;
    private bool _followCursor = true;

    // Return flight (after pointing bubble) — cancels if user moves cursor too much
    private bool _isReturning;
    private double _returnInitialCursorX, _returnInitialCursorY;
    private const double ReturnCancelDistance = 100.0;

    // Waveform
    private readonly double[] _waveformProfile = [0.4, 0.7, 1.0, 0.7, 0.4];
    private double _audioPower;
    private double _idlePulsePhase;
    private readonly Rectangle[] _bars = new Rectangle[5];

    // Spinner
    private double _spinnerAngle;

    // Speech bubble
    private string _fullBubbleText = "";
    private int _bubbleCharIndex;
    private DispatcherTimer? _bubbleTimer;
    private DispatcherTimer? _bubbleHoldTimer;

    // Update notification
    private string? _updateUrl;

    // Icon style
    private bool _isCursorStyle;

    // State
    private CompanionState _currentState = CompanionState.Idle;
    private DateTime _lastFrameTime;

    // Random phrases for pointing
    private static readonly string[] PointingPhrases = [
        "bem aqui!", "esse aqui!", "olha aqui!", "clica aqui!", "achei!", "é esse!"
    ];
    private static readonly Random Rng = new();

    public BuddyCursorWindow()
    {
        InitializeComponent();

        var screen = Screen.PrimaryScreen!;
        // Minus 1px to prevent Windows from treating this as fullscreen (auto-hides taskbar)
        Width = screen.Bounds.Width - 1;
        Height = screen.Bounds.Height - 1;
        Left = screen.Bounds.Left;
        Top = screen.Bounds.Top;

        _bars[0] = Bar0; _bars[1] = Bar1; _bars[2] = Bar2; _bars[3] = Bar3; _bars[4] = Bar4;

        SourceInitialized += OnSourceInitialized;
        CompositionTarget.Rendering += OnRender;

        GetCursorPos(out POINT pt);
        _buddyX = pt.X + OffsetX;
        _buddyY = pt.Y + OffsetY;
        _targetX = _buddyX;
        _targetY = _buddyY;
        _lastFrameTime = DateTime.UtcNow;
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        int exStyle = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetWindowLong(hwnd, GWL_EXSTYLE, exStyle | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE);
    }

    private void OnRender(object? sender, EventArgs e)
    {
        var now = DateTime.UtcNow;
        double dt = (now - _lastFrameTime).TotalSeconds;
        _lastFrameTime = now;
        dt = Math.Min(dt, 0.05); // Cap delta time

        if (_isFlying)
        {
            UpdateFlight(dt);
        }
        else if (_followCursor)
        {
            GetCursorPos(out POINT pt);
            _targetX = pt.X + OffsetX;
            _targetY = pt.Y + OffsetY;
            UpdateSpringPhysics(dt);
        }

        // Update visuals
        UpdateBuddyPosition();
        UpdateEyes();

        if (_currentState == CompanionState.Recording)
        {
            UpdateWaveform(dt);
        }
        else if (_currentState == CompanionState.Processing)
        {
            UpdateSpinner(dt);
        }
    }

    // --- Spring Physics ---

    private void UpdateSpringPhysics(double dt)
    {
        double dx = _targetX - _buddyX;
        double dy = _targetY - _buddyY;

        // Spring force: F = -kx - cv
        double forceX = SpringStiffness * dx - SpringDamping * _velocityX;
        double forceY = SpringStiffness * dy - SpringDamping * _velocityY;

        _velocityX += forceX * dt;
        _velocityY += forceY * dt;

        _buddyX += _velocityX * dt;
        _buddyY += _velocityY * dt;
    }

    // --- Bezier Arc Flight ---

    public void AnimateToTarget(double screenX, double screenY, string? bubbleText = null)
    {
        _followCursor = false;
        _isFlying = true;
        _flightProgress = 0;

        _flightStartX = _buddyX;
        _flightStartY = _buddyY;
        _flightEndX = screenX + PointOffsetX;
        _flightEndY = screenY + PointOffsetY;

        // Calculate distance and flight duration
        double dx = _flightEndX - _flightStartX;
        double dy = _flightEndY - _flightStartY;
        double distance = Math.Sqrt(dx * dx + dy * dy);
        _flightDuration = Math.Clamp(distance / 800.0, 0.6, 1.4);

        // Control point: offset upward by 20% of distance (max 80px)
        double arcHeight = Math.Min(distance * 0.2, 80);
        _flightControlX = (_flightStartX + _flightEndX) / 2;
        _flightControlY = Math.Min(_flightStartY, _flightEndY) - arcHeight;

        _fullBubbleText = bubbleText ?? PointingPhrases[Rng.Next(PointingPhrases.Length)];
    }

    private void UpdateFlight(double dt)
    {
        // During return flight, cancel if user moves the cursor too much
        if (_isReturning)
        {
            GetCursorPos(out POINT cursor);
            double cdx = cursor.X - _returnInitialCursorX;
            double cdy = cursor.Y - _returnInitialCursorY;
            if (Math.Sqrt(cdx * cdx + cdy * cdy) > ReturnCancelDistance)
            {
                FollowCursor();
                return;
            }
        }

        _flightProgress += dt / _flightDuration;

        if (_flightProgress >= 1.0)
        {
            _flightProgress = 1.0;
            _isFlying = false;
            _buddyX = _flightEndX;
            _buddyY = _flightEndY;
            _velocityX = 0;
            _velocityY = 0;

            if (_isReturning)
            {
                // Done returning — resume normal cursor following
                FollowCursor();
                return;
            }

            // Forward flight just landed on a target — show speech bubble
            ShowSpeechBubble(_fullBubbleText);
            return;
        }

        // Hermite smoothstep interpolation
        double t = _flightProgress;
        double smooth = t * t * (3 - 2 * t);

        // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)*t*P1 + t^2*P2
        double oneMinusT = 1 - smooth;
        _buddyX = oneMinusT * oneMinusT * _flightStartX
                + 2 * oneMinusT * smooth * _flightControlX
                + smooth * smooth * _flightEndX;
        _buddyY = oneMinusT * oneMinusT * _flightStartY
                + 2 * oneMinusT * smooth * _flightControlY
                + smooth * smooth * _flightEndY;

        // Scale pulse: sin(progress * pi) -> 1.0 to 1.3 at midpoint
        double scale = 1.0 + 0.3 * Math.Sin(_flightProgress * Math.PI);
        if (_isCursorStyle)
        {
            CursorScale.ScaleX = scale;
            CursorScale.ScaleY = scale;
            CursorShadow.BlurRadius = 16 + (scale - 1.0) * 40;
        }
        else
        {
            BodyScale.ScaleX = scale;
            BodyScale.ScaleY = scale;
            BodyShadow.BlurRadius = 16 + (scale - 1.0) * 40;
        }
    }

    public void FollowCursor()
    {
        _followCursor = true;
        _isFlying = false;
        _isReturning = false;
        BodyScale.ScaleX = 1;
        BodyScale.ScaleY = 1;
        BodyShadow.BlurRadius = 16;
        CursorScale.ScaleX = 1;
        CursorScale.ScaleY = 1;
        CursorShadow.BlurRadius = 16;
        HideSpeechBubble();
    }

    /// <summary>
    /// After the speech bubble holds, fly the buddy back to the cursor with the
    /// same Bezier physics. Cancels mid-flight if the user moves the cursor more
    /// than ReturnCancelDistance pixels from where it was when we started returning.
    /// </summary>
    private void StartReturnFlight()
    {
        GetCursorPos(out POINT pt);
        _returnInitialCursorX = pt.X;
        _returnInitialCursorY = pt.Y;

        _flightStartX = _buddyX;
        _flightStartY = _buddyY;
        _flightEndX = pt.X + OffsetX;
        _flightEndY = pt.Y + OffsetY;

        double dx = _flightEndX - _flightStartX;
        double dy = _flightEndY - _flightStartY;
        double distance = Math.Sqrt(dx * dx + dy * dy);

        // Very short return: just snap and follow
        if (distance < 8)
        {
            FollowCursor();
            return;
        }

        _flightDuration = Math.Clamp(distance / 800.0, 0.6, 1.4);
        double arcHeight = Math.Min(distance * 0.2, 80);
        _flightControlX = (_flightStartX + _flightEndX) / 2;
        _flightControlY = Math.Min(_flightStartY, _flightEndY) - arcHeight;

        _flightProgress = 0;
        _isFlying = true;
        _isReturning = true;
        _followCursor = false;
    }

    // --- Position Update ---

    private void UpdateBuddyPosition()
    {
        double rx = _buddyX - Left;
        double ry = _buddyY - Top;

        if (_isCursorStyle)
        {
            // Triangle pointer: centered on buddy position
            Canvas.SetLeft(CursorPointer, rx - 8);
            Canvas.SetTop(CursorPointer, ry - 9);

            // No separate glow — the Path's DropShadowEffect is enough
            GlowEllipse.Visibility = Visibility.Collapsed;

            // Waveform and spinner to the right of pointer
            Canvas.SetLeft(WaveformCanvas, rx + 14);
            Canvas.SetTop(WaveformCanvas, ry - 10);
            Canvas.SetLeft(SpinnerCanvas, rx + 14);
            Canvas.SetTop(SpinnerCanvas, ry - 9);
        }
        else
        {
            // Glow (centered, 50x50)
            GlowEllipse.Visibility = Visibility.Visible;
            Canvas.SetLeft(GlowEllipse, rx - 28);
            Canvas.SetTop(GlowEllipse, ry - 28);

            // Body (centered, 36x36)
            Canvas.SetLeft(BuddyBody, rx - 18);
            Canvas.SetTop(BuddyBody, ry - 18);

            // Waveform (to the right of buddy)
            Canvas.SetLeft(WaveformCanvas, rx + 22);
            Canvas.SetTop(WaveformCanvas, ry - 10);
            Canvas.SetLeft(SpinnerCanvas, rx - 9);
            Canvas.SetTop(SpinnerCanvas, ry - 9);
        }

        // Speech bubble (offset right and below)
        Canvas.SetLeft(SpeechBubble, rx + 10);
        Canvas.SetTop(SpeechBubble, ry + 18);
    }

    private void UpdateEyes()
    {
        if (_isCursorStyle) return;

        double rx = _buddyX - Left;
        double ry = _buddyY - Top;

        double eyeOffsetX = Math.Clamp(_velocityX * 0.02, -3, 3);
        double eyeOffsetY = Math.Clamp(_velocityY * 0.02, -3, 3);

        // If flying, eyes look toward target
        if (_isFlying)
        {
            double dx = _flightEndX - _buddyX;
            double dy = _flightEndY - _buddyY;
            double dist = Math.Sqrt(dx * dx + dy * dy);
            if (dist > 1)
            {
                eyeOffsetX = (dx / dist) * 3;
                eyeOffsetY = (dy / dist) * 3;
            }
        }

        Canvas.SetLeft(LeftEye, rx - 8 + eyeOffsetX);
        Canvas.SetTop(LeftEye, ry - 3 + eyeOffsetY);
        Canvas.SetLeft(RightEye, rx + 3 + eyeOffsetX);
        Canvas.SetTop(RightEye, ry - 3 + eyeOffsetY);
    }

    // --- Waveform ---

    public void SetAudioPower(double power)
    {
        _audioPower = Math.Clamp(Math.Pow(power, 0.76) * 2.85, 0, 1);
    }

    private void UpdateWaveform(double dt)
    {
        _idlePulsePhase += dt * 3.0;
        double idlePulse = (Math.Sin(_idlePulsePhase) + 1) / 2 * 1.5;

        for (int i = 0; i < 5; i++)
        {
            double height = 3 + (_audioPower * 10 * _waveformProfile[i]) + idlePulse;
            _bars[i].Height = height;
            Canvas.SetLeft(_bars[i], i * 4); // 2px bar + 2px gap
            Canvas.SetTop(_bars[i], 10 - height / 2); // Center vertically
        }
    }

    // --- Spinner ---

    private void UpdateSpinner(double dt)
    {
        _spinnerAngle += dt * 450; // 360/0.8 = 450 deg/sec
        if (_spinnerAngle >= 360) _spinnerAngle -= 360;
        SpinnerRotation.Angle = _spinnerAngle;
    }

    // --- Speech Bubble ---

    public void ShowSpeechBubble(string text)
    {
        _fullBubbleText = text;
        _bubbleCharIndex = 0;
        BubbleText.Text = "";
        SpeechBubble.Visibility = Visibility.Visible;

        // Pop-in animation
        BubbleScale.ScaleX = 0.5;
        BubbleScale.ScaleY = 0.5;
        var scaleXAnim = new DoubleAnimation(0.5, 1.0, TimeSpan.FromMilliseconds(400))
        { EasingFunction = new ElasticEase { Oscillations = 1, Springiness = 5 } };
        var scaleYAnim = new DoubleAnimation(0.5, 1.0, TimeSpan.FromMilliseconds(400))
        { EasingFunction = new ElasticEase { Oscillations = 1, Springiness = 5 } };
        BubbleScale.BeginAnimation(ScaleTransform.ScaleXProperty, scaleXAnim);
        BubbleScale.BeginAnimation(ScaleTransform.ScaleYProperty, scaleYAnim);

        // Stream characters at 40ms intervals
        _bubbleTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(40) };
        _bubbleTimer.Tick += (_, _) =>
        {
            if (_bubbleCharIndex < _fullBubbleText.Length)
            {
                BubbleText.Text += _fullBubbleText[_bubbleCharIndex];
                _bubbleCharIndex++;
            }
            else
            {
                _bubbleTimer.Stop();
                // Hold for 3 seconds then fly back to cursor
                _bubbleHoldTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
                _bubbleHoldTimer.Tick += (_, _) =>
                {
                    _bubbleHoldTimer.Stop();
                    HideSpeechBubble();
                    StartReturnFlight();
                    BubbleHoldComplete?.Invoke();
                };
                _bubbleHoldTimer.Start();
            }
        };
        _bubbleTimer.Start();
    }

    private void HideSpeechBubble()
    {
        _bubbleTimer?.Stop();
        _bubbleHoldTimer?.Stop();
        SpeechBubble.Visibility = Visibility.Collapsed;
        BubbleText.Text = "";
    }

    public void SetUpdateUrl(string url) => _updateUrl = url;

    public event Action? BubbleHoldComplete;

    // --- State Updates ---

    public void UpdateState(CompanionState state)
    {
        _currentState = state;

        var (startColor, endColor, glowColor) = state switch
        {
            CompanionState.Idle => (Color.FromRgb(124, 58, 237), Color.FromRgb(168, 85, 247), Color.FromRgb(124, 58, 237)),
            CompanionState.Recording => (Color.FromRgb(239, 68, 68), Color.FromRgb(248, 113, 113), Color.FromRgb(239, 68, 68)),
            CompanionState.Processing => (Color.FromRgb(245, 158, 11), Color.FromRgb(251, 191, 36), Color.FromRgb(245, 158, 11)),
            CompanionState.Speaking => (Color.FromRgb(16, 185, 129), Color.FromRgb(52, 211, 153), Color.FromRgb(16, 185, 129)),
            _ => (Color.FromRgb(124, 58, 237), Color.FromRgb(168, 85, 247), Color.FromRgb(124, 58, 237))
        };

        GradientStart.Color = startColor;
        GradientEnd.Color = endColor;
        GlowColor.Color = glowColor;
        BodyShadow.Color = glowColor;

        // Cursor style colors
        CursorGradStart.Color = startColor;
        CursorGradEnd.Color = endColor;
        CursorShadow.Color = glowColor;

        // Update bar colors for waveform
        foreach (var bar in _bars)
            bar.Fill = new SolidColorBrush(startColor);

        // Update spinner color
        SpinnerArc.Stroke = new SolidColorBrush(startColor);

        // Show/hide indicators
        WaveformCanvas.Visibility = state == CompanionState.Recording ? Visibility.Visible : Visibility.Collapsed;
        SpinnerCanvas.Visibility = state == CompanionState.Processing ? Visibility.Visible : Visibility.Collapsed;
    }

    public void ShowWelcomeMessage(string? message = null)
    {
        var text = message ?? "oi! eu sou o tico";
        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.5) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            ShowSpeechBubble(text);
        };
        timer.Start();
    }

    // --- Transient Mode ---

    private bool _transientMode = false;

    public void SetTransientMode(bool enabled)
    {
        _transientMode = enabled;
        if (enabled) HideBuddy();
        else ShowBuddy();
    }

    public void ShowTransiently()
    {
        if (_transientMode)
        {
            Opacity = 1;
            Show();
        }
    }

    public void FadeOutIfTransient()
    {
        if (!_transientMode) return;

        var timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(400));
            fadeOut.Completed += (_, _) => Hide();
            BeginAnimation(OpacityProperty, fadeOut);
        };
        timer.Start();
    }

    // --- Icon Style ---

    public void SetIconStyle(string style)
    {
        _isCursorStyle = style == "cursor";

        BuddyBody.Visibility = _isCursorStyle ? Visibility.Collapsed : Visibility.Visible;
        LeftEye.Visibility = _isCursorStyle ? Visibility.Collapsed : Visibility.Visible;
        RightEye.Visibility = _isCursorStyle ? Visibility.Collapsed : Visibility.Visible;
        CursorPointer.Visibility = _isCursorStyle ? Visibility.Visible : Visibility.Collapsed;

        // Sync colors to current state
        UpdateState(_currentState);
    }

    public void ShowBuddy() => Show();
    public void HideBuddy() => Hide();
}
