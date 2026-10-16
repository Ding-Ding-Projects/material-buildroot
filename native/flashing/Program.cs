using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

// This helper has no shell-command field and never changes disk online state.
internal static class Program
{
    record Request(int Version, string Operation, string Nonce, int DiskNumber, string Identity, long Capacity, string Source, string Sha256, long Bytes);
    record Disk(int Number, string FriendlyName, string SerialNumber, string UniqueId, long Size, bool IsBoot, bool IsSystem, bool IsOffline, bool IsReadOnly, string BusType);
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DeviceIoControl(SafeFileHandle handle, uint code, byte[]? input, int inputSize, byte[] output, int outputSize, out int returned, IntPtr overlapped);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int MessageBox(IntPtr window, string text, string title, uint type);
    static string Identity(Disk d) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{d.Number}\n{d.UniqueId}\n{d.SerialNumber}\n{d.Size}\n{d.BusType}"))).ToLowerInvariant();
    static Disk[] Disks()
    {
        // Fixed host script. No value from a request is interpolated into PowerShell.
        const string script = "$ErrorActionPreference='Stop'; ConvertTo-Json -Compress -InputObject @(Get-Disk | Select-Object Number,FriendlyName,SerialNumber,UniqueId,Size,IsBoot,IsSystem,IsOffline,IsReadOnly,@{n='BusType';e={$_.BusType.ToString()}})";
        var start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe")) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add("-NoProfile"); start.ArgumentList.Add("-NonInteractive"); start.ArgumentList.Add("-EncodedCommand"); start.ArgumentList.Add(Convert.ToBase64String(Encoding.Unicode.GetBytes(script)));
        using var process = Process.Start(start) ?? throw new IOException("Disk discovery unavailable");
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(30000)) { process.Kill(true); throw new IOException("Disk discovery timeout"); }
        if (process.ExitCode != 0 || stdout.Result.Length > 131072) throw new IOException("Disk discovery failed");
        return JsonSerializer.Deserialize<Disk[]>(stdout.Result, Json) ?? throw new IOException("Disk discovery missing");
    }
    static Disk Match(Request r)
    {
        var d = Disks().Single(d => d.Number == r.DiskNumber);
        if (d.IsBoot || d.IsSystem || !d.IsOffline || d.IsReadOnly || string.IsNullOrWhiteSpace(d.UniqueId) || string.IsNullOrWhiteSpace(d.SerialNumber) || d.Size < r.Bytes || d.Size != r.Capacity || Identity(d) != r.Identity) throw new IOException("Destination changed or protected");
        return d;
    }
    static void CheckHandle(SafeFileHandle handle, Request r)
    {
        var number = new byte[12];
        if (!DeviceIoControl(handle, 0x2D1080, null, 0, number, number.Length, out var count, IntPtr.Zero) || count < 12 || BitConverter.ToUInt32(number, 4) != r.DiskNumber) throw new IOException("Device handle identity mismatch");
        var length = new byte[8];
        if (!DeviceIoControl(handle, 0x7405C, null, 0, length, length.Length, out count, IntPtr.Zero) || count < 8 || BitConverter.ToInt64(length) != r.Capacity) throw new IOException("Device handle capacity mismatch");
    }
    static void Cancel(string folder) { if (File.Exists(Path.Combine(folder, "cancel"))) throw new OperationCanceledException(); }
    static int Main(string[] args)
    {
        if (args.Length != 1 || !Path.IsPathFullyQualified(args[0])) return 2;
        var requestPath = Path.GetFullPath(args[0]); var folder = Path.GetDirectoryName(requestPath)!;
        if (Path.GetFileName(requestPath) != "request.json" || !Directory.Exists(folder) || (File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0) return 2;
        string state = "incomplete", reason = "Operation did not complete", nonce = ""; long written = 0; object? result = null;
        try
        {
            if (new FileInfo(requestPath).Length > 16384 || (File.GetAttributes(requestPath) & FileAttributes.ReparsePoint) != 0) throw new IOException("Invalid request");
            var r = JsonSerializer.Deserialize<Request>(File.ReadAllText(requestPath), Json) ?? throw new IOException("Invalid request"); nonce = r.Nonce;
            if (r.Version != 1 || !Guid.TryParseExact(r.Nonce, "D", out _) || r.DiskNumber < 0 || r.DiskNumber > 4095) throw new IOException("Invalid protocol");
            Cancel(folder);
            if (r.Operation == "discover")
            {
                result = Disks().Select(d => new { id = d.Number, name = d.FriendlyName, identity = Identity(d), capacity = d.Size, bus = d.BusType, eligible = !d.IsBoot && !d.IsSystem && d.IsOffline && !d.IsReadOnly && !string.IsNullOrWhiteSpace(d.UniqueId) && !string.IsNullOrWhiteSpace(d.SerialNumber), protection = d.IsBoot || d.IsSystem ? "system-or-boot" : !d.IsOffline ? "online-or-mounted" : d.IsReadOnly ? "read-only" : string.IsNullOrWhiteSpace(d.UniqueId) || string.IsNullOrWhiteSpace(d.SerialNumber) ? "identity-unavailable" : "none" }).ToArray();
                state = "discovered"; reason = "No disk modified";
            }
            else if (r.Operation == "write" && r.Bytes > 0 && r.Bytes <= 16L * 1024 * 1024 * 1024 && r.Bytes % 512 == 0 && r.Sha256.Length == 64 && r.Sha256.All(Uri.IsHexDigit) && Path.IsPathFullyQualified(r.Source) && !r.Source.StartsWith(@"\\.\") && !r.Source.StartsWith(@"\\?\"))
            {
                if ((File.GetAttributes(r.Source) & (FileAttributes.ReparsePoint | FileAttributes.Directory)) != 0) throw new IOException("Source type changed");
                // FileShare.Read prevents replacement, deletion and concurrent writes for the operation.
                using var source = new FileStream(r.Source, FileMode.Open, FileAccess.Read, FileShare.Read);
                if (source.Length != r.Bytes || Convert.ToHexString(SHA256.HashData(source)).ToLowerInvariant() != r.Sha256) throw new IOException("Source changed");
                source.Position = 0; var header = new byte[32774]; var read = source.Read(header);
                if (read < 512 || !(header[510] == 0x55 && header[511] == 0xaa || read >= 32774 && Encoding.ASCII.GetString(header, 32769, 5) == "CD001")) throw new IOException("Unsupported image format");
                var disk = Match(r);
                var warning = $"PERMANENT DATA LOSS / 永久資料損失\n\nPhysicalDrive{disk.Number}: {disk.FriendlyName}\nIdentity: {r.Identity}\nCapacity: {r.Capacity} bytes\nSource SHA-256: {r.Sha256}\nWrite: {r.Bytes} bytes\n\nAll existing partitions and data become unusable. Cancellation cannot restore overwritten bytes. Continue?\n現有分割區同資料將無法使用，取消無法還原已寫入資料。繼續？";
                if (MessageBox(IntPtr.Zero, warning, "Material Buildroot: destructive write", 0x00000134) != 6) throw new OperationCanceledException();
                Cancel(folder); Match(r);
                using var handle = CreateFile($@"\\.\PhysicalDrive{r.DiskNumber}", 0xC0000000, 0, IntPtr.Zero, 3, 0x80000000, IntPtr.Zero);
                if (handle.IsInvalid) throw new IOException("Exclusive device access unavailable");
                CheckHandle(handle, r); Match(r); Cancel(folder);
                using var destination = new FileStream(handle, FileAccess.ReadWrite, 1024 * 1024, false);
                source.Position = 0; var buffer = new byte[1024 * 1024];
                while ((read = source.Read(buffer)) > 0) { Cancel(folder); destination.Write(buffer, 0, read); written += read; }
                destination.Flush(true); destination.Position = 0;
                using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256); long remaining = r.Bytes;
                while (remaining > 0) { Cancel(folder); read = destination.Read(buffer, 0, (int)Math.Min(remaining, buffer.Length)); if (read == 0) throw new IOException("Readback truncated"); hash.AppendData(buffer, 0, read); remaining -= read; }
                if (Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant() != r.Sha256) throw new IOException("Readback mismatch");
                CheckHandle(handle, r); state = "verified"; reason = "Written range readback matches source; boot not verified";
                result = new { identity = r.Identity, sha256 = r.Sha256, bytes = written, bootVerified = false };
            }
            else throw new IOException("Unsupported operation");
        }
        catch (OperationCanceledException) { state = written == 0 ? "cancelled" : "incomplete"; reason = written == 0 ? "Cancelled before writing" : "Cancelled after partial write; destination must not be used"; }
        catch { reason = written == 0 ? "Preparation or native operation failed; no completed write is claimed" : "Partial write or readback failed; destination must not be used"; }
        try { var receipt = JsonSerializer.Serialize(new { version = 1, nonce, state, reason, written, result }); using var output = new FileStream(Path.Combine(folder, "result.json"), FileMode.CreateNew, FileAccess.Write, FileShare.None); var bytes = Encoding.UTF8.GetBytes(receipt); output.Write(bytes); output.Flush(true); } catch { return 3; }
        return state is "verified" or "discovered" ? 0 : 1;
    }
}

