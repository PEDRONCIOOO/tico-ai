using System.IO;
using NAudio.Wave;

namespace Tico.App.Services;

public class AudioCaptureService : IAudioCaptureService, IDisposable
{
    private WaveInEvent? _waveIn;
    private MemoryStream? _buffer;
    private WaveFileWriter? _writer;
    private System.Threading.Timer? _maxDurationTimer;

    private const int MaxRecordingSeconds = 60;
    private static readonly WaveFormat WhisperFormat = new(16000, 16, 1);

    public event Action<double>? AudioPowerChanged;

    public void StartRecording()
    {
        _buffer = new MemoryStream();
        _waveIn = new WaveInEvent
        {
            WaveFormat = WhisperFormat,
            BufferMilliseconds = 50
        };
        _writer = new WaveFileWriter(new IgnoreDisposeStream(_buffer), WhisperFormat);
        _waveIn.DataAvailable += OnDataAvailable;
        _waveIn.StartRecording();
        _maxDurationTimer = new System.Threading.Timer(
            _ => _waveIn?.StopRecording(),
            null,
            MaxRecordingSeconds * 1000,
            Timeout.Infinite);
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        _writer?.Write(e.Buffer, 0, e.BytesRecorded);
        if (AudioPowerChanged != null && e.BytesRecorded > 0)
        {
            AudioPowerChanged.Invoke(ComputeRmsPower(e.Buffer, e.BytesRecorded));
        }
    }

    /// <summary>
    /// Compute RMS of 16-bit signed PCM, normalized to 0..1.
    /// </summary>
    internal static double ComputeRmsPower(byte[] buffer, int bytesRecorded)
    {
        int sampleCount = bytesRecorded / 2;
        if (sampleCount == 0) return 0;
        long sumOfSquares = 0;
        for (int i = 0; i + 1 < bytesRecorded; i += 2)
        {
            short sample = (short)(buffer[i] | (buffer[i + 1] << 8));
            sumOfSquares += sample * sample;
        }
        double rms = Math.Sqrt((double)sumOfSquares / sampleCount);
        return rms / 32768.0;
    }

    public byte[] StopRecording()
    {
        _maxDurationTimer?.Dispose();
        _maxDurationTimer = null;
        _waveIn?.StopRecording();
        _writer?.Flush();
        var data = _buffer?.ToArray() ?? [];
        _writer?.Dispose();
        _waveIn?.Dispose();
        _buffer?.Dispose();
        _writer = null;
        _waveIn = null;
        _buffer = null;
        return data;
    }

    public void Dispose()
    {
        _maxDurationTimer?.Dispose();
        _waveIn?.StopRecording();
        _writer?.Dispose();
        _waveIn?.Dispose();
        _buffer?.Dispose();
        GC.SuppressFinalize(this);
    }
}

internal class IgnoreDisposeStream(Stream inner) : Stream
{
    public override bool CanRead => inner.CanRead;
    public override bool CanSeek => inner.CanSeek;
    public override bool CanWrite => inner.CanWrite;
    public override long Length => inner.Length;
    public override long Position { get => inner.Position; set => inner.Position = value; }
    public override void Flush() => inner.Flush();
    public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
    public override long Seek(long offset, SeekOrigin origin) => inner.Seek(offset, origin);
    public override void SetLength(long value) => inner.SetLength(value);
    public override void Write(byte[] buffer, int offset, int count) => inner.Write(buffer, offset, count);
    protected override void Dispose(bool disposing) { /* do not dispose inner */ }
}
