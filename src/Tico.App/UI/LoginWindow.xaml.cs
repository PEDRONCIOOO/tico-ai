using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Animation;
using Tico.App.Config;
using Tico.App.Services;

namespace Tico.App.UI;

public partial class LoginWindow : Window
{
    private readonly IAuthService _auth;
    private readonly AppSettings _settings;

    public Session? Result { get; private set; }

    public LoginWindow(IAuthService auth, AppSettings settings)
    {
        InitializeComponent();
        _auth = auth;
        _settings = settings;

        // Allow dragging the window from anywhere
        MouseLeftButtonDown += (_, e) =>
        {
            if (e.ButtonState == MouseButtonState.Pressed)
                DragMove();
        };

        Loaded += (_, _) => EmailBox.Focus();
    }

    private async void OnLogin(object sender, RoutedEventArgs e)
    {
        await TryLoginAsync();
    }

    private async void OnPasswordKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
            await TryLoginAsync();
    }

    private async Task TryLoginAsync()
    {
        var email = EmailBox.Text.Trim();
        var password = PasswordBox.Password;

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
        {
            ShowError("preencha email e senha");
            return;
        }

        ErrorBox.Visibility = Visibility.Collapsed;
        SetLoading(true);
        try
        {
            var session = await _auth.LoginAsync(email, password);
            Result = session;
            DialogResult = true;
            Close();
        }
        catch (AuthException ex)
        {
            ShowError(ex.Message);
        }
        catch (Exception ex)
        {
            ShowError($"erro de conexão: {ex.Message}");
        }
        finally
        {
            SetLoading(false);
        }
    }

    private void SetLoading(bool loading)
    {
        LoginButton.IsEnabled = !loading;
        EmailBox.IsEnabled = !loading;
        PasswordBox.IsEnabled = !loading;
        LoginButtonText.Text = loading ? "entrando..." : "entrar";
        Spinner.Visibility = loading ? Visibility.Visible : Visibility.Collapsed;

        if (loading)
        {
            var spin = new DoubleAnimation(0, 360, TimeSpan.FromMilliseconds(800))
            {
                RepeatBehavior = RepeatBehavior.Forever
            };
            SpinnerRotation.BeginAnimation(System.Windows.Media.RotateTransform.AngleProperty, spin);
        }
        else
        {
            SpinnerRotation.BeginAnimation(System.Windows.Media.RotateTransform.AngleProperty, null);
        }
    }

    private void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorBox.Visibility = Visibility.Visible;
    }

    private void OnOpenRegister(object sender, RoutedEventArgs e)
    {
        try
        {
            var url = $"{_settings.WebBaseUrl.TrimEnd('/')}/register";
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            ShowError($"não consegui abrir o navegador: {ex.Message}");
        }
    }

    private void OnClose(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
