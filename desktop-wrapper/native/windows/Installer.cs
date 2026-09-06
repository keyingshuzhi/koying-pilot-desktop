using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace KoyingPilot.Desktop
{
    internal static class InstallerProgram
    {
        [STAThread]
        private static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
#if UNINSTALLER
            if (args.Length == 3 && args[0] == "--finish-uninstall")
            {
                return InstallationSupport.FinishUninstall(args[1], args[2]);
            }
            return InstallationSupport.BeginUninstall();
#else
            if (args.Length == 1 && args[0] == "--verify") return InstallationSupport.VerifyPayload();
            Application.Run(new SetupForm());
            return 0;
#endif
        }
    }

#if !UNINSTALLER
    internal sealed class SetupForm : Form
    {
        private const string DisplayName = "柯影智航";
        private readonly Button installButton;
        private readonly Button cancelButton;
        private readonly Button browseButton;
        private readonly CheckBox desktopShortcut;
        private readonly CheckBox launchApplication;
        private readonly TextBox pathTextBox;
        private readonly ProgressBar progress;

        internal SetupForm()
        {
            Text = DisplayName + " 安装程序";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ClientSize = new Size(620, 310);

            Label title = new Label
            {
                AutoSize = true,
                Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 18, FontStyle.Bold),
                Location = new Point(28, 25),
                Text = "安装" + DisplayName,
            };
            Label description = new Label
            {
                AutoSize = false,
                Location = new Point(31, 70),
                Size = new Size(555, 44),
                Text = "将 Koying Pilot Windows x64 桌面应用安装到当前用户。\r\n无需管理员权限或预装 Node.js。",
            };
            Label pathLabel = new Label
            {
                AutoSize = true,
                Location = new Point(31, 120),
                Text = "安装位置",
            };
            pathTextBox = new TextBox
            {
                Location = new Point(31, 141),
                Size = new Size(455, 27),
                Text = InstallationSupport.SuggestedInstallDirectory,
            };
            browseButton = new Button
            {
                Location = new Point(496, 139),
                Size = new Size(90, 30),
                Text = "浏览…",
            };
            desktopShortcut = new CheckBox
            {
                AutoSize = true,
                Checked = true,
                Location = new Point(33, 188),
                Text = "创建桌面快捷方式",
            };
            launchApplication = new CheckBox
            {
                AutoSize = true,
                Checked = true,
                Location = new Point(210, 188),
                Text = "安装完成后启动",
            };
            progress = new ProgressBar
            {
                Location = new Point(31, 221),
                Size = new Size(555, 13),
                Style = ProgressBarStyle.Marquee,
                Visible = false,
            };
            installButton = new Button
            {
                Location = new Point(418, 260),
                Size = new Size(80, 30),
                Text = "安装",
            };
            cancelButton = new Button
            {
                DialogResult = DialogResult.Cancel,
                Location = new Point(506, 260),
                Size = new Size(80, 30),
                Text = "取消",
            };
            browseButton.Click += delegate { SelectInstallDirectory(); };
            installButton.Click += async delegate { await InstallAsync(); };
            AcceptButton = installButton;
            CancelButton = cancelButton;
            Controls.AddRange(new Control[]
            {
                title,
                description,
                pathLabel,
                pathTextBox,
                browseButton,
                desktopShortcut,
                launchApplication,
                progress,
                installButton,
                cancelButton,
            });
        }

        private void SelectInstallDirectory()
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择应用安装目录（程序文件会直接写入所选目录）";
                dialog.ShowNewFolderButton = true;
                dialog.SelectedPath = InstallationSupport.FindExistingDirectory(pathTextBox.Text);
                if (dialog.ShowDialog(this) == DialogResult.OK) pathTextBox.Text = dialog.SelectedPath;
            }
        }

        private async Task InstallAsync()
        {
            installButton.Enabled = false;
            cancelButton.Enabled = false;
            desktopShortcut.Enabled = false;
            launchApplication.Enabled = false;
            pathTextBox.Enabled = false;
            browseButton.Enabled = false;
            progress.Visible = true;
            try
            {
                bool createDesktopShortcut = desktopShortcut.Checked;
                string installDirectory = pathTextBox.Text;
                InstallationResult result = await Task.Run(delegate
                {
                    return InstallationSupport.Install(installDirectory, createDesktopShortcut);
                });

                if (!result.WebView2Available)
                {
                    DialogResult choice = MessageBox.Show(
                        this,
                        "应用已安装，但系统缺少 Microsoft Edge WebView2 Runtime。是否打开微软官方下载页？",
                        DisplayName,
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Warning);
                    if (choice == DialogResult.Yes)
                    {
                        Process.Start(new ProcessStartInfo(InstallationSupport.WebView2DownloadUrl)
                        {
                            UseShellExecute = true,
                        });
                    }
                }
                else if (launchApplication.Checked)
                {
                    Process.Start(new ProcessStartInfo(result.ApplicationPath) { UseShellExecute = true });
                }

                MessageBox.Show(this, "安装完成。", DisplayName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    this,
                    "安装失败：" + error.Message,
                    DisplayName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                installButton.Enabled = true;
                cancelButton.Enabled = true;
                desktopShortcut.Enabled = true;
                launchApplication.Enabled = true;
                pathTextBox.Enabled = true;
                browseButton.Enabled = true;
                progress.Visible = false;
            }
        }
    }
#endif

    internal sealed class InstallationResult
    {
        internal string ApplicationPath { get; set; }
        internal bool WebView2Available { get; set; }
    }

    internal static class InstallationSupport
    {
        internal const string WebView2DownloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
        private const string ProductName = "柯影智航";
        private const string ProductId = "KoyingPilot";
        private const string PayloadMagic = "KYPZIP01";
        private const int MaximumCompatibleDirectoryPathLength = 247;
        private const int MaximumCompatibleFilePathLength = 259;
        private const int MoveFileDelayUntilReboot = 0x00000004;

        internal static readonly string DefaultInstallDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "Koying Pilot");

        internal static string SuggestedInstallDirectory
        {
            get { return ReadRegisteredInstallDirectory() ?? DefaultInstallDirectory; }
        }

        internal static InstallationResult Install(string requestedInstallDirectory, bool createDesktopShortcut)
        {
            string previousInstallDirectory = ReadRegisteredInstallDirectory();
            string installDirectory = ValidateInstallDirectory(requestedInstallDirectory, previousInstallDirectory);
            if (previousInstallDirectory != null
                && !PathsEqual(previousInstallDirectory, installDirectory)
                && PathsOverlap(previousInstallDirectory, installDirectory))
            {
                throw new InvalidOperationException("新安装位置不能包含现有安装目录，也不能位于现有安装目录内。");
            }

            string parent = Path.GetDirectoryName(installDirectory);
            Directory.CreateDirectory(parent);
            string staging = null;
            string backup = null;
            string payload = Path.Combine(Path.GetTempPath(), "KoyingPilot-" + Guid.NewGuid().ToString("N") + ".zip");
            try
            {
                staging = CreateShortSiblingPath(parent, installDirectory, null);
                Directory.CreateDirectory(staging);
                backup = CreateShortSiblingPath(parent, installDirectory, staging);
                CloseRunningApplication();
                ReadPayload(Process.GetCurrentProcess().MainModule.FileName, payload);
                ValidatePayloadDestination(payload, installDirectory);
                ExtractPayload(payload, staging);
                string stagedApplication = Path.Combine(staging, "KoyingPilot.exe");
                if (!File.Exists(stagedApplication)) throw new InvalidDataException("安装包缺少 KoyingPilot.exe。");

                bool movedExisting = false;
                if (Directory.Exists(installDirectory))
                {
                    Directory.Move(installDirectory, backup);
                    movedExisting = true;
                }
                try
                {
                    Directory.Move(staging, installDirectory);
                }
                catch
                {
                    if (movedExisting && !Directory.Exists(installDirectory)) Directory.Move(backup, installDirectory);
                    throw;
                }

                TryDeleteDirectory(backup);
                string application = Path.Combine(installDirectory, "KoyingPilot.exe");
                CreateShortcut(StartMenuShortcutPath, application, installDirectory);
                if (createDesktopShortcut) CreateShortcut(DesktopShortcutPath, application, installDirectory);
                else TryDeleteFile(DesktopShortcutPath);
                WriteUninstallRegistration(application, installDirectory);

                if (previousInstallDirectory != null
                    && !PathsEqual(previousInstallDirectory, installDirectory)
                    && IsRecognizedInstallationDirectory(previousInstallDirectory))
                {
                    TryDeleteDirectory(previousInstallDirectory);
                }

                return new InstallationResult
                {
                    ApplicationPath = application,
                    WebView2Available = CheckWebView2(application),
                };
            }
            finally
            {
                TryDeleteFile(payload);
                if (staging != null) TryDeleteDirectory(staging);
            }
        }

        internal static int VerifyPayload()
        {
            string payload = Path.Combine(Path.GetTempPath(), "KoyingPilotVerify-" + Guid.NewGuid().ToString("N") + ".zip");
            string extracted = null;
            try
            {
                extracted = CreateShortSiblingPath(NormalizeDirectory(Path.GetTempPath()), payload, null);
                ReadPayload(Process.GetCurrentProcess().MainModule.FileName, payload);
                ExtractPayload(payload, extracted);
                return File.Exists(Path.Combine(extracted, "KoyingPilot.exe")) ? 0 : 1;
            }
            catch
            {
                return 1;
            }
            finally
            {
                TryDeleteFile(payload);
                if (extracted != null) TryDeleteDirectory(extracted);
            }
        }

        internal static int BeginUninstall()
        {
            string source = Process.GetCurrentProcess().MainModule.FileName;
            string sourceDirectory = NormalizeDirectory(Path.GetDirectoryName(source));
            string registeredDirectory = ReadRegisteredInstallDirectory();
            if (registeredDirectory == null
                || !PathsEqual(sourceDirectory, registeredDirectory)
                || !IsRecognizedInstallationDirectory(sourceDirectory))
            {
                MessageBox.Show(
                    "卸载程序与已登记的安装位置不一致，已停止卸载。",
                    ProductName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 1;
            }

            DialogResult result = MessageBox.Show(
                "是否卸载" + ProductName + "？用户设置、会话与凭据数据将保留。",
                ProductName,
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);
            if (result != DialogResult.Yes) return 0;

            string temporary = Path.Combine(Path.GetTempPath(), "KoyingPilotUninstall-" + Guid.NewGuid().ToString("N") + ".exe");
            File.Copy(source, temporary, true);
            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = temporary,
                Arguments = "--finish-uninstall " + Quote(sourceDirectory) + " " + Process.GetCurrentProcess().Id,
                UseShellExecute = false,
            };
            Process.Start(startInfo);
            return 0;
        }

        internal static int FinishUninstall(string requestedDirectory, string parentProcessId)
        {
            string requested;
            try
            {
                requested = NormalizeDirectory(requestedDirectory);
            }
            catch (Exception error)
            {
                MessageBox.Show("卸载路径无效：" + error.Message, ProductName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            string registeredDirectory = ReadRegisteredInstallDirectory();
            if (registeredDirectory == null
                || !PathsEqual(requested, registeredDirectory)
                || !IsRecognizedInstallationDirectory(requested))
            {
                MessageBox.Show("拒绝卸载未登记或无法识别的安装目录。", ProductName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            int processId;
            if (int.TryParse(parentProcessId, out processId))
            {
                try
                {
                    Process.GetProcessById(processId).WaitForExit(10000);
                }
                catch (ArgumentException)
                {
                    // The launching uninstaller exited before this helper inspected it.
                }
            }

            try
            {
                CloseRunningApplication();
                TryDeleteFile(StartMenuShortcutPath);
                TryDeleteFile(DesktopShortcutPath);
                Registry.CurrentUser.DeleteSubKeyTree(UninstallRegistryPath, false);
                DeleteDirectoryWithRetries(requested);
                MessageBox.Show(
                    "卸载完成。用户设置、会话与凭据数据保留在本地应用数据目录中。",
                    ProductName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                MoveFileEx(Process.GetCurrentProcess().MainModule.FileName, null, MoveFileDelayUntilReboot);
                return 0;
            }
            catch (Exception error)
            {
                MessageBox.Show("卸载失败：" + error.Message, ProductName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        private static string StartMenuShortcutPath
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                    ProductName + ".lnk");
            }
        }

        private static string DesktopShortcutPath
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    ProductName + ".lnk");
            }
        }

        private static string UninstallRegistryPath
        {
            get { return @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + ProductId; }
        }

        internal static string FindExistingDirectory(string requestedDirectory)
        {
            try
            {
                string candidate = NormalizeDirectory(requestedDirectory);
                while (!Directory.Exists(candidate))
                {
                    DirectoryInfo parent = Directory.GetParent(candidate);
                    if (parent == null) break;
                    candidate = parent.FullName;
                }
                if (Directory.Exists(candidate)) return candidate;
            }
            catch (ArgumentException)
            {
                // An incomplete typed path falls back to the default location for browsing.
            }
            catch (NotSupportedException)
            {
                // An incomplete typed path falls back to the default location for browsing.
            }
            catch (PathTooLongException)
            {
                // An incomplete typed path falls back to the default location for browsing.
            }

            string fallback = DefaultInstallDirectory;
            while (!Directory.Exists(fallback))
            {
                DirectoryInfo parent = Directory.GetParent(fallback);
                if (parent == null) return string.Empty;
                fallback = parent.FullName;
            }
            return fallback;
        }

        private static string ValidateInstallDirectory(string requestedDirectory, string registeredDirectory)
        {
            if (string.IsNullOrWhiteSpace(requestedDirectory))
            {
                throw new InvalidOperationException("请选择安装位置。");
            }
            if (!IsFullyQualifiedPath(requestedDirectory))
            {
                throw new InvalidOperationException("请输入完整的安装路径。");
            }

            string installDirectory = NormalizeDirectory(requestedDirectory);
            string root = NormalizeDirectory(Path.GetPathRoot(installDirectory));
            if (PathsEqual(installDirectory, root))
            {
                throw new InvalidOperationException("不能将应用直接安装到磁盘根目录。");
            }

            string applicationDataDirectory = NormalizeDirectory(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Koying Pilot"));
            if (PathsOverlap(installDirectory, applicationDataDirectory))
            {
                throw new InvalidOperationException("安装位置不能包含用户设置与会话数据目录，也不能位于该目录内。");
            }
            if (File.Exists(installDirectory))
            {
                throw new InvalidOperationException("安装位置已被同名文件占用。");
            }
            if (Directory.Exists(installDirectory)
                && Directory.GetFileSystemEntries(installDirectory).Length != 0
                && (registeredDirectory == null
                    || !PathsEqual(installDirectory, registeredDirectory)
                    || !IsRecognizedInstallationDirectory(installDirectory)))
            {
                throw new InvalidOperationException("所选目录不是空目录，且不是当前已登记的柯影智航安装位置。请选择空目录或其他位置。");
            }
            return installDirectory;
        }

        private static string ReadRegisteredInstallDirectory()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(UninstallRegistryPath, false))
                {
                    if (key == null) return null;
                    string value = key.GetValue("InstallLocation") as string;
                    if (string.IsNullOrWhiteSpace(value) || !IsFullyQualifiedPath(value)) return null;
                    return NormalizeDirectory(value);
                }
            }
            catch (ArgumentException)
            {
                // A malformed stale registration must not become an installer filesystem target.
                return null;
            }
            catch (NotSupportedException)
            {
                // A malformed stale registration must not become an installer filesystem target.
                return null;
            }
            catch (PathTooLongException)
            {
                // A malformed stale registration must not become an installer filesystem target.
                return null;
            }
            catch (IOException)
            {
                // An unreadable stale registration must not become an installer filesystem target.
                return null;
            }
            catch (UnauthorizedAccessException)
            {
                // A registry policy may hide the optional per-user installation record.
                return null;
            }
            catch (System.Security.SecurityException)
            {
                // A registry policy may hide the optional per-user installation record.
                return null;
            }
        }

        private static bool IsRecognizedInstallationDirectory(string directory)
        {
            return Directory.Exists(directory)
                && File.Exists(Path.Combine(directory, "KoyingPilot.exe"))
                && File.Exists(Path.Combine(directory, "Uninstall.exe"));
        }

        private static bool IsFullyQualifiedPath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            string candidate = path.Trim();
            if (candidate.StartsWith(@"\\", StringComparison.Ordinal)) return true;
            return candidate.Length >= 3
                && char.IsLetter(candidate[0])
                && candidate[1] == ':'
                && (candidate[2] == Path.DirectorySeparatorChar || candidate[2] == Path.AltDirectorySeparatorChar);
        }

        private static bool PathsEqual(string left, string right)
        {
            return NormalizeDirectory(left).Equals(NormalizeDirectory(right), StringComparison.OrdinalIgnoreCase);
        }

        private static bool PathsOverlap(string left, string right)
        {
            string normalizedLeft = NormalizeDirectory(left);
            string normalizedRight = NormalizeDirectory(right);
            if (normalizedLeft.Equals(normalizedRight, StringComparison.OrdinalIgnoreCase)) return true;
            return normalizedLeft.StartsWith(WithTrailingSeparator(normalizedRight), StringComparison.OrdinalIgnoreCase)
                || normalizedRight.StartsWith(WithTrailingSeparator(normalizedLeft), StringComparison.OrdinalIgnoreCase);
        }

        private static string WithTrailingSeparator(string path)
        {
            if (path.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal)) return path;
            return path + Path.DirectorySeparatorChar;
        }

        private static string NormalizeDirectory(string path)
        {
            string fullPath = Path.GetFullPath(path.Trim()).Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
            string root = Path.GetPathRoot(fullPath);
            if (fullPath.Equals(root, StringComparison.OrdinalIgnoreCase)) return fullPath;
            return fullPath.TrimEnd(Path.DirectorySeparatorChar);
        }

        private static string CreateShortSiblingPath(string parent, string firstUnavailable, string secondUnavailable)
        {
            const string candidates = "0123456789abcdefghijklmnopqrstuvwxyz_";
            int start = (Guid.NewGuid().GetHashCode() & int.MaxValue) % candidates.Length;
            for (int offset = 0; offset < candidates.Length; offset += 1)
            {
                string candidate = Path.Combine(parent, candidates[(start + offset) % candidates.Length].ToString());
                if ((firstUnavailable != null && PathsEqual(candidate, firstUnavailable))
                    || (secondUnavailable != null && PathsEqual(candidate, secondUnavailable)))
                {
                    continue;
                }
                if (!Directory.Exists(candidate) && !File.Exists(candidate)) return candidate;
            }
            throw new InvalidOperationException("安装目录旁没有可用的临时目录名称，请选择其他安装位置。");
        }

        private static string NormalizeArchiveRelativePath(string entryName)
        {
            string candidate = entryName.Replace('/', Path.DirectorySeparatorChar);
            if (Path.IsPathRooted(candidate)) throw new InvalidDataException("安装包包含越界路径。");

            List<string> segments = new List<string>();
            foreach (string segment in candidate.Split(new[] { Path.DirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (segment == ".") continue;
                if (segment == ".." || segment.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
                {
                    throw new InvalidDataException("安装包包含越界路径。");
                }
                if (segment.Length > 255) throw new InvalidDataException("安装包包含过长的文件名。");
                segments.Add(segment);
            }
            return string.Join(Path.DirectorySeparatorChar.ToString(), segments.ToArray());
        }

        private static void ValidatePayloadDestination(string payload, string destination)
        {
            int maximumDestinationLength = int.MaxValue;
            using (ZipArchive archive = ZipFile.OpenRead(payload))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string relative = NormalizeArchiveRelativePath(entry.FullName);
                    if (relative.Length == 0) continue;
                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        maximumDestinationLength = Math.Min(
                            maximumDestinationLength,
                            MaximumCompatibleDirectoryPathLength - 1 - relative.Length);
                        continue;
                    }

                    maximumDestinationLength = Math.Min(
                        maximumDestinationLength,
                        MaximumCompatibleFilePathLength - 1 - relative.Length);
                    int separator = relative.LastIndexOf(Path.DirectorySeparatorChar);
                    if (separator >= 0)
                    {
                        maximumDestinationLength = Math.Min(
                            maximumDestinationLength,
                            MaximumCompatibleDirectoryPathLength - 1 - separator);
                    }
                }
            }

            string normalizedDestination = NormalizeDirectory(destination);
            if (normalizedDestination.Length > maximumDestinationLength)
            {
                throw new PathTooLongException(
                    "安装位置过深（当前 " + normalizedDestination.Length + " 个字符）。"
                    + "为兼容 Windows 文件系统，请将安装路径缩短到 "
                    + maximumDestinationLength + " 个字符以内，例如 D:\\Koying Pilot。");
            }
        }

        private static void ReadPayload(string setupExecutable, string destination)
        {
            byte[] magic = System.Text.Encoding.ASCII.GetBytes(PayloadMagic);
            using (FileStream input = File.OpenRead(setupExecutable))
            {
                if (input.Length < 16) throw new InvalidDataException("安装包没有有效载荷。");
                input.Seek(-16, SeekOrigin.End);
                byte[] trailer = new byte[16];
                ReadExactly(input, trailer, 0, trailer.Length);
                for (int index = 0; index < magic.Length; index += 1)
                {
                    if (trailer[8 + index] != magic[index]) throw new InvalidDataException("安装包有效载荷标记无效。");
                }
                long payloadLength = BitConverter.ToInt64(trailer, 0);
                long payloadStart = input.Length - 16 - payloadLength;
                if (payloadLength <= 0 || payloadStart < 0) throw new InvalidDataException("安装包有效载荷长度无效。");
                input.Position = payloadStart;
                using (FileStream output = File.Create(destination))
                {
                    byte[] buffer = new byte[1024 * 1024];
                    long remaining = payloadLength;
                    while (remaining > 0)
                    {
                        int read = input.Read(buffer, 0, (int)Math.Min(buffer.Length, remaining));
                        if (read == 0) throw new EndOfStreamException("安装包有效载荷被截断。");
                        output.Write(buffer, 0, read);
                        remaining -= read;
                    }
                }
            }
        }

        private static void ExtractPayload(string payload, string destination)
        {
            ValidatePayloadDestination(payload, destination);
            Directory.CreateDirectory(destination);
            string root = NormalizeDirectory(destination) + Path.DirectorySeparatorChar;
            using (ZipArchive archive = ZipFile.OpenRead(payload))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string relative = NormalizeArchiveRelativePath(entry.FullName);
                    if (relative.Length == 0) continue;
                    string target = root + relative;
                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(target);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (Stream input = entry.Open())
                    using (FileStream output = File.Create(target)) input.CopyTo(output);
                }
            }
        }

        private static void ReadExactly(Stream input, byte[] buffer, int offset, int count)
        {
            while (count > 0)
            {
                int read = input.Read(buffer, offset, count);
                if (read == 0) throw new EndOfStreamException();
                offset += read;
                count -= read;
            }
        }

        private static void CloseRunningApplication()
        {
            foreach (Process process in Process.GetProcessesByName("KoyingPilot"))
            {
                try
                {
                    process.Kill();
                    process.WaitForExit(5000);
                }
                catch (InvalidOperationException)
                {
                    // The application exited between enumeration and termination.
                }
                finally
                {
                    process.Dispose();
                }
            }
        }

        private static bool CheckWebView2(string application)
        {
            using (Process process = Process.Start(new ProcessStartInfo
            {
                FileName = application,
                Arguments = "--check-webview2",
                UseShellExecute = false,
                CreateNoWindow = true,
            }))
            {
                if (!process.WaitForExit(15000))
                {
                    process.Kill();
                    return false;
                }
                return process.ExitCode == 0;
            }
        }

        private static void CreateShortcut(string shortcutPath, string application, string installDirectory)
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) throw new InvalidOperationException("Windows Script Host 不可用，无法创建快捷方式。");
            object shell = Activator.CreateInstance(shellType);
            object shortcut = null;
            try
            {
                shortcut = shellType.InvokeMember(
                    "CreateShortcut",
                    BindingFlags.InvokeMethod,
                    null,
                    shell,
                    new object[] { shortcutPath });
                Type shortcutType = shortcut.GetType();
                shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { application });
                shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { installDirectory });
                shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { application + ",0" });
                shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { ProductName });
                shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            finally
            {
                if (shortcut != null && Marshal.IsComObject(shortcut)) Marshal.FinalReleaseComObject(shortcut);
                if (Marshal.IsComObject(shell)) Marshal.FinalReleaseComObject(shell);
            }
        }

        private static void WriteUninstallRegistration(string application, string installDirectory)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallRegistryPath))
            {
                if (key == null) throw new InvalidOperationException("无法写入卸载注册信息。");
                string uninstaller = Path.Combine(installDirectory, "Uninstall.exe");
                key.SetValue("DisplayName", ProductName);
                key.SetValue("DisplayVersion", BuildInfo.ProductVersion);
                key.SetValue("Publisher", "柯影数智团队");
                key.SetValue("InstallLocation", installDirectory);
                key.SetValue("DisplayIcon", application + ",0");
                key.SetValue("UninstallString", Quote(uninstaller));
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("EstimatedSize", EstimateKilobytes(installDirectory), RegistryValueKind.DWord);
            }
        }

        private static int EstimateKilobytes(string root)
        {
            long bytes = 0;
            foreach (string file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            {
                bytes += new FileInfo(file).Length;
            }
            return (int)Math.Min(int.MaxValue, (bytes + 1023) / 1024);
        }

        private static void DeleteDirectoryWithRetries(string path)
        {
            for (int attempt = 0; attempt < 10; attempt += 1)
            {
                try
                {
                    if (Directory.Exists(path)) Directory.Delete(path, true);
                    return;
                }
                catch (IOException)
                {
                    if (attempt == 9) throw;
                    Thread.Sleep(250);
                }
                catch (UnauthorizedAccessException)
                {
                    if (attempt == 9) throw;
                    Thread.Sleep(250);
                }
            }
        }

        private static void TryDeleteDirectory(string path)
        {
            if (!Directory.Exists(path)) return;
            try
            {
                Directory.Delete(path, true);
            }
            catch (IOException)
            {
                // An antivirus or running process may retain an obsolete staging directory.
            }
            catch (UnauthorizedAccessException)
            {
                // The completed installation remains usable when stale staging cleanup is denied.
            }
        }

        private static void TryDeleteFile(string path)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch (IOException)
            {
                // Cleanup is best-effort for temporary payloads and optional shortcuts.
            }
            catch (UnauthorizedAccessException)
            {
                // Cleanup is best-effort for temporary payloads and optional shortcuts.
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool MoveFileEx(string existingFile, string newFile, int flags);
    }
}
