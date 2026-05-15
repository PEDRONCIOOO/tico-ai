using System.Collections.ObjectModel;

namespace Tico.App.Core;

public class ChatHistoryStore
{
    private readonly int _maxEntries;

    public ObservableCollection<ChatEntry> Entries { get; } = [];

    public event Action<ChatEntry>? EntryAdded;

    public ChatHistoryStore(int maxEntries = 50)
    {
        _maxEntries = maxEntries;
    }

    public void AddEntry(string userQuestion, string ticoResponse)
    {
        var entry = new ChatEntry(userQuestion, ticoResponse, DateTime.UtcNow);
        Entries.Add(entry);

        while (Entries.Count > _maxEntries)
            Entries.RemoveAt(0);

        EntryAdded?.Invoke(entry);
    }

    public void Clear() => Entries.Clear();
}
