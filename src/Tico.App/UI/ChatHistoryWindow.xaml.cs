using System.Collections.Specialized;
using System.Windows;
using Tico.App.Core;

namespace Tico.App.UI;

public partial class ChatHistoryWindow : Window
{
    private readonly ChatHistoryStore _store;

    public ChatHistoryWindow(ChatHistoryStore store)
    {
        InitializeComponent();
        _store = store;

        // Allow dragging
        MouseLeftButtonDown += (_, _) => DragMove();

        ChatList.ItemsSource = _store.Entries;
        UpdateEmptyState();

        // Auto-scroll when new entries arrive
        _store.Entries.CollectionChanged += OnCollectionChanged;
    }

    private void OnCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        UpdateEmptyState();

        if (e.Action == NotifyCollectionChangedAction.Add)
        {
            ChatScroll.ScrollToEnd();
        }
    }

    private void UpdateEmptyState()
    {
        EmptyState.Visibility = _store.Entries.Count == 0
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    private void OnClear(object sender, RoutedEventArgs e)
    {
        _store.Clear();
        UpdateEmptyState();
    }

    private void OnClose(object sender, RoutedEventArgs e)
    {
        Hide();
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        // Don't destroy — just hide so we can reshow
        e.Cancel = true;
        Hide();
    }
}
