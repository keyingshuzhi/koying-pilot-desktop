using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace KoyingPilot.Desktop
{
    internal static class Program
    {
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string appID);

        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length == 1 && args[0] == "--check-webview2")
            {
                try
                {
                    string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                    return string.IsNullOrWhiteSpace(version) ? 1 : 0;
                }
                catch
                {
                    return 1;
                }
            }

            SetCurrentProcessExplicitAppUserModelID("ai.keyingdigital.koyingpilot");
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }
    }

    internal sealed class MainForm : Form
    {
        private const string DisplayName = "柯影智航";
        private const string ReadyMarker = "dsh web: http://127.0.0.1:";
        private const int JobObjectExtendedLimitInformationClass = 9;
        private const uint JobObjectLimitKillOnJobClose = 0x00002000;

        private readonly WebView2 webView;
        private readonly Label statusLabel;
        private readonly StringBuilder errorBuffer = new StringBuilder();
        private Process harness;
        private IntPtr harnessJob = IntPtr.Zero;
        private bool stopping;

        internal MainForm()
        {
            Text = DisplayName;
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(900, 620);
            ClientSize = new Size(1280, 820);

            webView = new WebView2
            {
                Dock = DockStyle.Fill,
                Visible = false,
            };
            statusLabel = new Label
            {
                Dock = DockStyle.Fill,
                Text = "正在启动柯影智航…",
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 13),
            };
            Controls.Add(webView);
            Controls.Add(statusLabel);

            Shown += async delegate { await StartAsync(); };
            FormClosing += delegate { StopHarness(); };
        }

        private async Task StartAsync()
        {
            try
            {
                string dataRoot = GetDataRoot();
                Directory.CreateDirectory(dataRoot);
                string browserData = Path.Combine(dataRoot, "WebView2");
                CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, browserData);
                await webView.EnsureCoreWebView2Async(environment);
                ConfigureWebView();
                LaunchHarness(dataRoot);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                Fail("Microsoft Edge WebView2 Runtime 未安装。请安装 WebView2 Runtime 后重新启动应用。");
            }
            catch (Exception error)
            {
                Fail("无法启动内置运行时：" + error.Message);
            }
        }

        private void ConfigureWebView()
        {
            webView.CoreWebView2.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
            {
                Uri uri;
                if (Uri.TryCreate(args.Uri, UriKind.Absolute, out uri) && IsLocalNavigation(uri)) return;
                args.Cancel = true;
                OpenExternal(uri);
            };
            webView.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args)
            {
                args.Handled = true;
                Uri uri;
                if (Uri.TryCreate(args.Uri, UriKind.Absolute, out uri)) OpenExternal(uri);
            };
        }

        private void LaunchHarness(string dataRoot)
        {
            string applicationRoot = AppDomain.CurrentDomain.BaseDirectory;
            string node = Path.Combine(applicationRoot, "runtime", "node.exe");
            string entry = Path.Combine(
                applicationRoot,
                "runtime",
                "app",
                "node_modules",
                "@deepseek-ai",
                "dsh",
                "lib",
                "bin.js");
            foreach (string required in new[] { node, entry })
            {
                if (!File.Exists(required)) throw new FileNotFoundException("应用不完整，缺少 " + required);
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = node,
                Arguments = Quote(entry) + " --profile desktop --port 0",
                WorkingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            RemoveCredentialEnvironment(startInfo);
            startInfo.EnvironmentVariables["DSH_HOME"] = dataRoot;
            startInfo.EnvironmentVariables["DSH_TELEMETRY_DISABLED"] = "1";

            IntPtr job = CreateHarnessJob();
            Process process = new Process
            {
                StartInfo = startInfo,
                EnableRaisingEvents = true,
            };
            process.OutputDataReceived += AcceptStandardOutput;
            process.ErrorDataReceived += AcceptStandardError;
            process.Exited += HarnessExited;
            try
            {
                if (!process.Start()) throw new InvalidOperationException("Node 进程未启动。");
                if (!AssignProcessToJobObject(job, process.Handle))
                {
                    throw new InvalidOperationException("无法绑定内置运行时进程树。");
                }
                harnessJob = job;
                harness = process;
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
            }
            catch
            {
                CloseHandle(job);
                try
                {
                    if (!process.HasExited) process.Kill();
                }
                catch (InvalidOperationException)
                {
                    // Process.Start failed before the process acquired an operating-system handle.
                }
                process.Dispose();
                throw;
            }
        }

        private void AcceptStandardOutput(object sender, DataReceivedEventArgs args)
        {
            if (args.Data == null) return;
            int marker = args.Data.IndexOf(ReadyMarker, StringComparison.Ordinal);
            if (marker < 0) return;
            string value = args.Data.Substring(marker + "dsh web: ".Length).Trim();
            int whitespace = value.IndexOfAny(new[] { ' ', '\t' });
            if (whitespace >= 0) value = value.Substring(0, whitespace);

            Uri uri;
            if (!Uri.TryCreate(value, UriKind.Absolute, out uri) || !IsLocalNavigation(uri)) return;
            BeginInvoke((Action)delegate
            {
                statusLabel.Visible = false;
                webView.Visible = true;
                webView.Source = uri;
            });
        }

        private void AcceptStandardError(object sender, DataReceivedEventArgs args)
        {
            if (args.Data == null) return;
            lock (errorBuffer)
            {
                errorBuffer.AppendLine(args.Data);
                if (errorBuffer.Length > 32768) errorBuffer.Remove(0, errorBuffer.Length - 32768);
            }
            Debug.WriteLine(args.Data);
        }

        private void HarnessExited(object sender, EventArgs args)
        {
            Process process = (Process)sender;
            if (stopping) return;
            string detail;
            lock (errorBuffer) detail = errorBuffer.ToString();
            BeginInvoke((Action)delegate
            {
                Fail("内置运行时意外停止（退出码 " + process.ExitCode + "）。\n\n" + detail);
            });
        }

        private void StopHarness()
        {
            if (stopping) return;
            stopping = true;
            if (harnessJob != IntPtr.Zero)
            {
                CloseHandle(harnessJob);
                harnessJob = IntPtr.Zero;
            }
            if (harness != null)
            {
                try
                {
                    if (!harness.HasExited) harness.WaitForExit(5000);
                }
                catch (InvalidOperationException)
                {
                    // The process was never started or was already released.
                }
                harness.Dispose();
                harness = null;
            }
        }

        private void Fail(string message)
        {
            StopHarness();
            MessageBox.Show(this, message, DisplayName, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }

        private static string GetDataRoot()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Koying Pilot");
        }

        private static void RemoveCredentialEnvironment(ProcessStartInfo startInfo)
        {
            List<string> keys = new List<string>();
            foreach (DictionaryEntry entry in startInfo.EnvironmentVariables) keys.Add((string)entry.Key);
            foreach (string key in keys)
            {
                string upper = key.ToUpperInvariant();
                if (upper.Contains("KEY") || upper.Contains("SECRET") ||
                    upper.Contains("TOKEN") || upper.Contains("PASSWORD"))
                {
                    startInfo.EnvironmentVariables.Remove(key);
                }
            }
        }

        private static bool IsLocalNavigation(Uri uri)
        {
            if (uri.Scheme == "about") return true;
            return uri.Scheme == Uri.UriSchemeHttp &&
                (uri.Host == "127.0.0.1" || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase));
        }

        private static void OpenExternal(Uri uri)
        {
            if (uri == null || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)) return;
            try
            {
                Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
            }
            catch (Exception error)
            {
                MessageBox.Show(error.Message, DisplayName, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static IntPtr CreateHarnessJob()
        {
            IntPtr job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) throw new InvalidOperationException("无法创建运行时 Job Object。");
            JobObjectExtendedLimitInformation information = new JobObjectExtendedLimitInformation();
            information.BasicLimitInformation.LimitFlags = JobObjectLimitKillOnJobClose;
            int length = Marshal.SizeOf(typeof(JobObjectExtendedLimitInformation));
            IntPtr pointer = Marshal.AllocHGlobal(length);
            try
            {
                Marshal.StructureToPtr(information, pointer, false);
                if (!SetInformationJobObject(job, JobObjectExtendedLimitInformationClass, pointer, (uint)length))
                {
                    CloseHandle(job);
                    throw new InvalidOperationException("无法配置运行时 Job Object。");
                }
            }
            finally
            {
                Marshal.FreeHGlobal(pointer);
            }
            return job;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct IoCounters
        {
            internal ulong ReadOperationCount;
            internal ulong WriteOperationCount;
            internal ulong OtherOperationCount;
            internal ulong ReadTransferCount;
            internal ulong WriteTransferCount;
            internal ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JobObjectBasicLimitInformation
        {
            internal long PerProcessUserTimeLimit;
            internal long PerJobUserTimeLimit;
            internal uint LimitFlags;
            internal UIntPtr MinimumWorkingSetSize;
            internal UIntPtr MaximumWorkingSetSize;
            internal uint ActiveProcessLimit;
            internal UIntPtr Affinity;
            internal uint PriorityClass;
            internal uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct JobObjectExtendedLimitInformation
        {
            internal JobObjectBasicLimitInformation BasicLimitInformation;
            internal IoCounters IoInfo;
            internal UIntPtr ProcessMemoryLimit;
            internal UIntPtr JobMemoryLimit;
            internal UIntPtr PeakProcessMemoryUsed;
            internal UIntPtr PeakJobMemoryUsed;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CreateJobObject(IntPtr securityAttributes, string name);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool SetInformationJobObject(
            IntPtr job,
            int informationClass,
            IntPtr information,
            uint informationLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CloseHandle(IntPtr handle);
    }
}
