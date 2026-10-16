import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';

/**
 * Starts a system tray icon using PowerShell + .NET Windows Forms.
 * Only runs on Windows. No extra dependencies needed.
 *
 * showNotice:   show a balloon so the user knows the widget lives in the tray
 * canAutostart: offer the "Start with Windows" menu item
 */
export function startTray(port, { showNotice = false, canAutostart = false } = {}) {
    if (process.platform !== 'win32') return;

    const settingsUrl = `http://127.0.0.1:${port}/settings.html`;
    const quitUrl = `http://127.0.0.1:${port}/quit`;
    // Value for the PowerShell single-quoted string below ('' escapes a quote)
    const startupCommand = `"${process.execPath}" --autostart`.replace(/'/g, "''");

    // PowerShell script that creates a NotifyIcon with context menu
    const ps1 = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Create a green circle icon (Spotify-like)
$bmp = New-Object System.Drawing.Bitmap(16, 16)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.FillEllipse([System.Drawing.Brushes]::LimeGreen, 1, 1, 14, 14)
$g.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

# Create NotifyIcon
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = $icon
$notify.Text = "Spotify Widget"
$notify.Visible = $true

# Context menu
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$openItem = New-Object System.Windows.Forms.ToolStripMenuItem("Open Settings")
$openItem.Add_Click({ Start-Process "${settingsUrl}" })

$sep1 = New-Object System.Windows.Forms.ToolStripSeparator

$startupItem = New-Object System.Windows.Forms.ToolStripMenuItem("Start with Windows")
# Check if startup registry key exists
try {
    $regVal = Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "SpotifyWidget" -ErrorAction Stop
    $startupItem.Checked = $true
} catch {
    $startupItem.Checked = $false
}
$startupItem.Add_Click({
    if ($startupItem.Checked) {
        Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "SpotifyWidget" -ErrorAction SilentlyContinue
        $startupItem.Checked = $false
    } else {
        Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "SpotifyWidget" -Value '${startupCommand}'
        $startupItem.Checked = $true
    }
})

$sep2 = New-Object System.Windows.Forms.ToolStripSeparator

$quitItem = New-Object System.Windows.Forms.ToolStripMenuItem("Quit")
$quitItem.Add_Click({
    try { Invoke-WebRequest -Uri "${quitUrl}" -Method POST -TimeoutSec 2 | Out-Null } catch {}
    $notify.Visible = $false
    $notify.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$menu.Items.Add($openItem) | Out-Null
${canAutostart ? `$menu.Items.Add($sep1) | Out-Null
$menu.Items.Add($startupItem) | Out-Null` : ''}
$menu.Items.Add($sep2) | Out-Null
$menu.Items.Add($quitItem) | Out-Null

$notify.ContextMenuStrip = $menu

# Double-click opens settings
$notify.Add_DoubleClick({ Start-Process "${settingsUrl}" })
$notify.Add_BalloonTipClicked({ Start-Process "${settingsUrl}" })
${showNotice ? `$notify.ShowBalloonTip(6000, "Spotify Widget is running", "It lives here in the system tray. Double-click the green icon to open the settings.", [System.Windows.Forms.ToolTipIcon]::Info)` : ''}

# Hide console window
Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);' -Name Win32 -Namespace Native
[Native.Win32]::ShowWindow([Native.Win32]::GetConsoleWindow(), 0) | Out-Null

# Run message loop
[System.Windows.Forms.Application]::Run()
`;

    const child = spawn('powershell', [
        '-NoProfile',
        '-WindowStyle', 'Hidden',
        '-Command', ps1,
    ], {
        detached: false,
        stdio: 'ignore',
        windowsHide: true,
    });

    child.unref();

    // If the main process exits, the tray will close automatically
    process.on('exit', () => {
        try { child.kill(); } catch { /* already gone */ }
    });
}
