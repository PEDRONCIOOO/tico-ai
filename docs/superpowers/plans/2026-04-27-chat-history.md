# Chat History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chat history panel that displays the user's spoken questions and Tico's written responses, togglable via settings.

**Architecture:** A new `ChatEntry` model captures clean question/response pairs. `CompanionManager` fires a `ChatEntryCompleted` event after each interaction. A `ChatHistoryWindow` (WPF) displays entries in a scrollable chat view. A small `ChatHistoryButton` window floats at top-center of the primary screen, appearing after the first question. Both are hidden when `AppSettings.ChatHistoryEnabled` is false.

**Tech Stack:** WPF .NET 8, same patterns as existing UI (borderless windows, Canvas positioning, dark theme matching SettingsWindow).

---

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/Tico.App/Core/ChatEntry.cs` | Record: UserQuestion, TicoResponse, Timestamp |
| Create | `src/Tico.App/Core/ChatHistoryStore.cs` | ObservableCollection wrapper, AddEntry, Clear |
| Create | `src/Tico.App/UI/ChatHistoryWindow.xaml` | Chat history panel XAML |
| Create | `src/Tico.App/UI/ChatHistoryWindow.xaml.cs` | Code-behind: data binding, scroll, close |
| Create | `src/Tico.App/UI/ChatHistoryButton.xaml` | Floating icon button XAML |
| Create | `src/Tico.App/UI/ChatHistoryButton.xaml.cs` | Code-behind: click to toggle, position, show/hide |
| Create | `tests/Tico.Tests/Core/ChatHistoryStoreTests.cs` | Tests for store add/clear/max |
| Modify | `src/Tico.App/Core/CompanionManager.cs` | Add ChatEntryCompleted event, fire after response |
| Modify | `src/Tico.App/Config/AppSettings.cs` | Add ChatHistoryEnabled bool |
| Modify | `src/Tico.App/UI/SettingsWindow.xaml` | Add toggle row |
| Modify | `src/Tico.App/UI/SettingsWindow.xaml.cs` | Wire toggle to setting |
| Modify | `src/Tico.App/App.xaml.cs` | Wire button, window, store, events |
| Modify | `tests/Tico.Tests/Core/CompanionManagerTests.cs` | Test event fires with correct data |

---

### Task 1: ChatEntry model + ChatHistoryStore with tests

**Files:**
- Create: `src/Tico.App/Core/ChatEntry.cs`
- Create: `src/Tico.App/Core/ChatHistoryStore.cs`
- Create: `tests/Tico.Tests/Core/ChatHistoryStoreTests.cs`

- [ ] **Step 1: Write the failing tests**

```csharp
// tests/Tico.Tests/Core/ChatHistoryStoreTests.cs
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test Tico.sln --filter "FullyQualifiedName~ChatHistoryStoreTests" --verbosity quiet`
Expected: Build failure — ChatHistoryStore and ChatEntry not defined.

- [ ] **Step 3: Implement ChatEntry and ChatHistoryStore**

```csharp
// src/Tico.App/Core/ChatEntry.cs
namespace Tico.App.Core;

public record ChatEntry(string UserQuestion, string TicoResponse, DateTime Timestamp);
```

```csharp
// src/Tico.App/Core/ChatHistoryStore.cs
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test Tico.sln --filter "FullyQualifiedName~ChatHistoryStoreTests" --verbosity quiet`
Expected: 5 tests pass.

---

### Task 2: CompanionManager fires ChatEntryCompleted event

**Files:**
- Modify: `src/Tico.App/Core/CompanionManager.cs:23-28` (add event)
- Modify: `src/Tico.App/Core/CompanionManager.cs:285-313` (fire event after response)
- Modify: `tests/Tico.Tests/Core/CompanionManagerTests.cs` (add test)

- [ ] **Step 1: Add event and helper to CompanionManager**

In `CompanionManager.cs`, add after the existing events (after line 34):

```csharp
// Chat history: emits the user's raw transcript + clean response (no POINT tags)
public event Action<string, string>? ChatEntryCompleted;
```

Add a static helper at the bottom of the class (before the closing brace):

```csharp
/// <summary>
/// Strip [POINT:...] tags from a response to produce clean text for display.
/// </summary>
internal static string StripPointTags(string text)
{
    return System.Text.RegularExpressions.Regex.Replace(text, @"\[POINT:[^\]]*\]", "").Trim();
}
```

- [ ] **Step 2: Capture the raw transcript and fire the event**

In `OnHotkeyUpAsync`, the variable `transcript` (line ~187) holds the user's raw question, and `responseText` (line ~285) holds the full Claude response. After `History.AddAssistantMessage(responseText);` (line ~313), add:

```csharp
ChatEntryCompleted?.Invoke(transcript, StripPointTags(responseText));
```

This requires `transcript` to be accessible at that point. It already is — it's declared earlier in the same method scope.

- [ ] **Step 3: Write test for StripPointTags**

Add to `tests/Tico.Tests/Core/CompanionManagerTests.cs`:

```csharp
[Theory]
[InlineData("olha aqui! [POINT:15:botão]", "olha aqui!")]
[InlineData("resposta sem point [POINT:none]", "resposta sem point")]
[InlineData("resposta limpa", "resposta limpa")]
[InlineData("[POINT:100,200:menu] texto depois", "texto depois")]
public void StripPointTags_removes_all_point_tags(string input, string expected)
{
    Assert.Equal(expected, CompanionManager.StripPointTags(input));
}
```

- [ ] **Step 4: Run all tests**

Run: `dotnet test Tico.sln --verbosity quiet`
Expected: All existing + new tests pass.

---

### Task 3: AppSettings.ChatHistoryEnabled

**Files:**
- Modify: `src/Tico.App/Config/AppSettings.cs:8-14`
- Modify: `tests/Tico.Tests/Config/AppSettingsTests.cs`

- [ ] **Step 1: Add property to AppSettings**

In `AppSettings.cs`, add after the `OmniParserApiKey` property (line 14):

```csharp
public bool ChatHistoryEnabled { get; set; } = true;
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

Run: `dotnet test Tico.sln --filter "FullyQualifiedName~AppSettingsTests" --verbosity quiet`
Expected: All pass — JSON deserialization ignores unknown properties, and new property has a default value.

---

### Task 4: SettingsWindow toggle for chat history

**Files:**
- Modify: `src/Tico.App/UI/SettingsWindow.xaml:101-110` (add toggle after "Show Tico" toggle)
- Modify: `src/Tico.App/UI/SettingsWindow.xaml.cs` (add event + handler)

- [ ] **Step 1: Add XAML toggle**

In `SettingsWindow.xaml`, add after the "Show Tico" toggle DockPanel (after line 110):

```xml
<!-- Chat History Toggle -->
<DockPanel Margin="16,10,16,0">
    <StackPanel Orientation="Horizontal" DockPanel.Dock="Left" VerticalAlignment="Center">
        <TextBlock Text="&#x1F4AC;" FontSize="12" Margin="0,0,8,0" VerticalAlignment="Center"/>
        <TextBlock Text="Historico de chat" Foreground="#ADB5B2" FontSize="13"
                   FontWeight="Medium" VerticalAlignment="Center"/>
    </StackPanel>
    <CheckBox x:Name="ChatHistoryToggle" DockPanel.Dock="Right" HorizontalAlignment="Right"
              IsChecked="True" Checked="OnChatHistoryToggleChanged" Unchecked="OnChatHistoryToggleChanged"/>
</DockPanel>
```

- [ ] **Step 2: Add event and handler in code-behind**

In `SettingsWindow.xaml.cs`, add event declaration after existing events (line ~20):

```csharp
public event Action<bool>? ChatHistoryVisibilityChanged;
```

Add handler method:

```csharp
private void OnChatHistoryToggleChanged(object sender, RoutedEventArgs e)
{
    var enabled = ChatHistoryToggle.IsChecked ?? true;
    _settings.ChatHistoryEnabled = enabled;
    _settings.SaveTo(AppSettings.DefaultPath);
    ChatHistoryVisibilityChanged?.Invoke(enabled);
}
```

In `LoadSettings()`, add at the end:

```csharp
ChatHistoryToggle.IsChecked = _settings.ChatHistoryEnabled;
```

- [ ] **Step 3: Verify build succeeds**

Run: `dotnet build Tico.sln --verbosity quiet`
Expected: Build succeeded.

---

### Task 5: ChatHistoryButton (floating icon)

**Files:**
- Create: `src/Tico.App/UI/ChatHistoryButton.xaml`
- Create: `src/Tico.App/UI/ChatHistoryButton.xaml.cs`

- [ ] **Step 1: Create XAML**

```xml
<!-- src/Tico.App/UI/ChatHistoryButton.xaml -->
<Window x:Class="Tico.App.UI.ChatHistoryButton"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        Topmost="True"
        ShowInTaskbar="False"
        ShowActivated="False"
        ResizeMode="NoResize"
        Width="40" Height="40">
    <Border x:Name="ButtonBorder" CornerRadius="20"
            Background="#CC171918" BorderBrush="#333333" BorderThickness="1"
            Cursor="Hand" MouseLeftButtonDown="OnClick"
            ToolTip="historico de chat">
        <Border.Effect>
            <DropShadowEffect BlurRadius="8" ShadowDepth="2" Opacity="0.4" Color="Black"/>
        </Border.Effect>
        <!-- Chat bubble icon using two dots like Tico's eyes -->
        <Grid>
            <TextBlock Text="&#x1F4AC;" FontSize="16"
                       HorizontalAlignment="Center" VerticalAlignment="Center"
                       Foreground="#A78BFA"/>
        </Grid>
    </Border>
</Window>
```

- [ ] **Step 2: Create code-behind**

```csharp
// src/Tico.App/UI/ChatHistoryButton.xaml.cs
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
```

- [ ] **Step 3: Verify build succeeds**

Run: `dotnet build Tico.sln --verbosity quiet`
Expected: Build succeeded.

---

### Task 6: ChatHistoryWindow

**Files:**
- Create: `src/Tico.App/UI/ChatHistoryWindow.xaml`
- Create: `src/Tico.App/UI/ChatHistoryWindow.xaml.cs`

- [ ] **Step 1: Create XAML**

```xml
<!-- src/Tico.App/UI/ChatHistoryWindow.xaml -->
<Window x:Class="Tico.App.UI.ChatHistoryWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Tico — Historico"
        Width="380" Height="520"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        Topmost="True"
        ShowInTaskbar="False"
        ResizeMode="NoResize">
    <Border Background="#171918" CornerRadius="12" BorderBrush="#1A1A1A" BorderThickness="1"
            Margin="8">
        <Border.Effect>
            <DropShadowEffect BlurRadius="20" ShadowDepth="4" Opacity="0.5" Color="Black"/>
        </Border.Effect>
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="Auto"/>
                <RowDefinition Height="*"/>
                <RowDefinition Height="Auto"/>
            </Grid.RowDefinitions>

            <!-- Header -->
            <DockPanel Grid.Row="0" Margin="16,14">
                <StackPanel Orientation="Horizontal" DockPanel.Dock="Left">
                    <TextBlock Text="&#x1F4AC;" FontSize="12" Margin="0,0,8,0" VerticalAlignment="Center"/>
                    <TextBlock Text="historico" Foreground="#ECEEED" FontSize="14"
                               FontWeight="SemiBold" VerticalAlignment="Center"/>
                </StackPanel>
                <Button DockPanel.Dock="Right" HorizontalAlignment="Right" Click="OnClose"
                        Background="Transparent" BorderThickness="0" Cursor="Hand" Padding="0">
                    <Grid Width="20" Height="20">
                        <Ellipse Fill="#FFFFFF" Opacity="0.08"/>
                        <TextBlock Text="&#x2715;" Foreground="#6B736F" FontSize="10"
                                   FontWeight="SemiBold" HorizontalAlignment="Center"
                                   VerticalAlignment="Center"/>
                    </Grid>
                </Button>
            </DockPanel>

            <!-- Divider -->
            <Rectangle Grid.Row="1" Height="1" Fill="#1E1E1E" Margin="16,0"/>

            <!-- Chat entries -->
            <ScrollViewer Grid.Row="2" x:Name="ChatScroll"
                          VerticalScrollBarVisibility="Auto" Margin="16,8,16,8">
                <ItemsControl x:Name="ChatList">
                    <ItemsControl.ItemTemplate>
                        <DataTemplate>
                            <StackPanel Margin="0,8,0,8">
                                <!-- User question -->
                                <Border Background="#7C3AED22" CornerRadius="8" Padding="10,8"
                                        HorizontalAlignment="Right" MaxWidth="280" Margin="40,0,0,4">
                                    <TextBlock Text="{Binding UserQuestion}" Foreground="#D4B9FA"
                                               FontSize="12" TextWrapping="Wrap"/>
                                </Border>
                                <!-- Tico response -->
                                <Border Background="#1E1E1E" CornerRadius="8" Padding="10,8"
                                        HorizontalAlignment="Left" MaxWidth="280" Margin="0,0,40,0">
                                    <TextBlock Text="{Binding TicoResponse}" Foreground="#ADB5B2"
                                               FontSize="12" TextWrapping="Wrap"/>
                                </Border>
                                <!-- Timestamp -->
                                <TextBlock Text="{Binding Timestamp, StringFormat='{}{0:HH:mm}'}"
                                           Foreground="#4A4A4A" FontSize="9" Margin="0,2,0,0"
                                           HorizontalAlignment="Left"/>
                            </StackPanel>
                        </DataTemplate>
                    </ItemsControl.ItemTemplate>
                </ItemsControl>
            </ScrollViewer>

            <!-- Empty state -->
            <TextBlock Grid.Row="2" x:Name="EmptyState"
                       Text="nenhuma conversa ainda.&#x0a;pressione F8 para falar com o tico."
                       Foreground="#4A4A4A" FontSize="12" TextAlignment="Center"
                       HorizontalAlignment="Center" VerticalAlignment="Center"
                       Visibility="Visible"/>

            <!-- Footer -->
            <DockPanel Grid.Row="3" Margin="16,8,16,12">
                <Button DockPanel.Dock="Right" Content="limpar" Click="OnClear"
                        Background="Transparent" Foreground="#6B736F" BorderThickness="0"
                        FontSize="11" Cursor="Hand" Padding="0"/>
            </DockPanel>
        </Grid>
    </Border>
</Window>
```

- [ ] **Step 2: Create code-behind**

```csharp
// src/Tico.App/UI/ChatHistoryWindow.xaml.cs
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
```

- [ ] **Step 3: Verify build succeeds**

Run: `dotnet build Tico.sln --verbosity quiet`
Expected: Build succeeded.

---

### Task 7: Wire everything in App.xaml.cs

**Files:**
- Modify: `src/Tico.App/App.xaml.cs`

- [ ] **Step 1: Add fields**

Add after existing fields (line ~23):

```csharp
private ChatHistoryStore? _chatStore;
private ChatHistoryButton? _chatButton;
private ChatHistoryWindow? _chatWindow;
```

- [ ] **Step 2: Initialize in Initialize() after _manager is created**

After `_manager = new CompanionManager(...)` (line ~72), add:

```csharp
_chatStore = new ChatHistoryStore();
```

After `_buddy.ShowWelcomeMessage();` (line ~78), add:

```csharp
// Chat history button + window
if (_settings.ChatHistoryEnabled)
{
    _chatButton = new ChatHistoryButton();
    _chatWindow = new ChatHistoryWindow(_chatStore);

    _chatButton.Clicked += () =>
    {
        Dispatcher.Invoke(() =>
        {
            if (_chatWindow.IsVisible)
                _chatWindow.Hide();
            else
                _chatWindow.Show();
        });
    };
}
```

- [ ] **Step 3: Subscribe to ChatEntryCompleted**

After the `_manager.AudioPowerUpdated` subscription (line ~140), add:

```csharp
_manager.ChatEntryCompleted += (question, response) =>
{
    if (!_settings.ChatHistoryEnabled) return;
    Dispatcher.Invoke(() =>
    {
        _chatStore?.AddEntry(question, response);
        _chatButton?.ShowWithFade();
    });
};
```

- [ ] **Step 4: Wire settings toggle**

In the `_tray.SettingsRequested` handler, after the existing `settingsWindow.BuddyVisibilityChanged` subscription, add:

```csharp
settingsWindow.ChatHistoryVisibilityChanged += enabled =>
{
    if (enabled)
    {
        if (_chatButton == null)
        {
            _chatButton = new ChatHistoryButton();
            _chatButton.Clicked += () => Dispatcher.Invoke(() =>
            {
                if (_chatWindow == null)
                    _chatWindow = new ChatHistoryWindow(_chatStore!);
                if (_chatWindow.IsVisible) _chatWindow.Hide();
                else _chatWindow.Show();
            });
        }
        if (_chatStore!.Entries.Count > 0)
            _chatButton.ShowWithFade();
    }
    else
    {
        _chatButton?.HideWithFade();
        _chatWindow?.Hide();
    }
};
```

- [ ] **Step 5: Verify build and run all tests**

Run: `dotnet build Tico.sln --verbosity quiet && dotnet test Tico.sln --verbosity quiet`
Expected: Build succeeded, all tests pass.

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `dotnet test Tico.sln --verbosity quiet`
Expected: All tests pass (existing 56 + new ~9).

- [ ] **Step 2: Verify no regressions in CompanionManager tests**

Run: `dotnet test Tico.sln --filter "FullyQualifiedName~CompanionManagerTests" --verbosity quiet`
Expected: All pass.
