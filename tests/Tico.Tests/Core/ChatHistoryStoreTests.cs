using Tico.App.Core;

namespace Tico.Tests.Core;

public class ChatHistoryStoreTests
{
    [Fact]
    public void AddEntry_stores_entry()
    {
        var store = new ChatHistoryStore();
        store.AddEntry("oi tico", "oi! tudo bem?");

        Assert.Single(store.Entries);
        Assert.Equal("oi tico", store.Entries[0].UserQuestion);
        Assert.Equal("oi! tudo bem?", store.Entries[0].TicoResponse);
    }

    [Fact]
    public void AddEntry_trims_to_max()
    {
        var store = new ChatHistoryStore(maxEntries: 3);
        store.AddEntry("q1", "r1");
        store.AddEntry("q2", "r2");
        store.AddEntry("q3", "r3");
        store.AddEntry("q4", "r4");

        Assert.Equal(3, store.Entries.Count);
        Assert.Equal("q2", store.Entries[0].UserQuestion);
        Assert.Equal("q4", store.Entries[2].UserQuestion);
    }

    [Fact]
    public void Clear_removes_all_entries()
    {
        var store = new ChatHistoryStore();
        store.AddEntry("q1", "r1");
        store.AddEntry("q2", "r2");
        store.Clear();

        Assert.Empty(store.Entries);
    }

    [Fact]
    public void AddEntry_fires_EntryAdded_event()
    {
        var store = new ChatHistoryStore();
        ChatEntry? received = null;
        store.EntryAdded += entry => received = entry;

        store.AddEntry("test", "response");

        Assert.NotNull(received);
        Assert.Equal("test", received!.UserQuestion);
    }

    [Fact]
    public void AddEntry_sets_timestamp()
    {
        var store = new ChatHistoryStore();
        var before = DateTime.UtcNow;
        store.AddEntry("q", "r");
        var after = DateTime.UtcNow;

        Assert.InRange(store.Entries[0].Timestamp, before, after);
    }
}
