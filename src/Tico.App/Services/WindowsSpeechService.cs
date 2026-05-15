using Windows.Media.SpeechRecognition;

namespace Tico.App.Services;

public class WindowsSpeechService : IDisposable
{
    private SpeechRecognizer? _recognizer;
    private string _currentResult = "";
    private TaskCompletionSource<string>? _tcs;
    public bool IsAvailable { get; private set; }

    public WindowsSpeechService()
    {
        try
        {
            InitializeAsync().GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Speech init failed: {ex.Message}");
            IsAvailable = false;
        }
    }

    private async Task InitializeAsync()
    {
        // Try PT-BR first, fallback to default
        try
        {
            _recognizer = new SpeechRecognizer(new Windows.Globalization.Language("pt-BR"));
        }
        catch
        {
            _recognizer = new SpeechRecognizer();
        }

        var dictation = new SpeechRecognitionTopicConstraint(
            SpeechRecognitionScenario.Dictation, "dictation");
        _recognizer.Constraints.Add(dictation);

        var compilationResult = await _recognizer.CompileConstraintsAsync();
        IsAvailable = compilationResult.Status == SpeechRecognitionResultStatus.Success;

        if (IsAvailable)
        {
            _recognizer.ContinuousRecognitionSession.ResultGenerated += (_, args) =>
            {
                if (args.Result.Status == SpeechRecognitionResultStatus.Success)
                {
                    _currentResult += args.Result.Text + " ";
                }
            };

            _recognizer.ContinuousRecognitionSession.Completed += (_, _) =>
            {
                _tcs?.TrySetResult(_currentResult.Trim());
            };

            System.Diagnostics.Debug.WriteLine($"Speech recognition ready: {_recognizer.CurrentLanguage.DisplayName}");
        }
    }

    public async Task StartListeningAsync()
    {
        if (!IsAvailable || _recognizer == null) return;
        _currentResult = "";
        _tcs = new TaskCompletionSource<string>();

        try
        {
            await _recognizer.ContinuousRecognitionSession.StartAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Start listening error: {ex.Message}");
            _tcs.TrySetResult("");
        }
    }

    public async Task<string> StopListeningAsync()
    {
        if (!IsAvailable || _recognizer == null || _tcs == null)
            return "";

        try
        {
            await _recognizer.ContinuousRecognitionSession.StopAsync();
        }
        catch
        {
            _tcs.TrySetResult(_currentResult.Trim());
        }

        // Wait for completion event with timeout
        var timeout = Task.Delay(3000);
        var completed = await Task.WhenAny(_tcs.Task, timeout);

        if (completed == timeout)
            return _currentResult.Trim();

        return await _tcs.Task;
    }

    // Legacy compatibility
    public Task<string> TranscribeAsync(byte[] wavData) => Task.FromResult("");

    public void Dispose()
    {
        _recognizer?.Dispose();
        GC.SuppressFinalize(this);
    }
}
