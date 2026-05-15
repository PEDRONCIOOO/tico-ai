namespace Tico.App.Services;

public interface IAudioCaptureService
{
    void StartRecording();
    byte[] StopRecording();

    /// <summary>
    /// Fires while recording with a normalized 0..1 RMS power value per audio buffer.
    /// Used by the buddy waveform visualizer.
    /// </summary>
    event Action<double>? AudioPowerChanged;
}
