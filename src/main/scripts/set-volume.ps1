param(
  [Parameter(Mandatory=$false)][string]$Action = "get",
  [Parameter(Mandatory=$false)][float]$Value = 0
)

$src = @"
using System;
using System.Runtime.InteropServices;

namespace WinAudio {
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioEndpointVolume {
        int f(); int g(); int h(); int i();
        int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
        int j();
        int GetMasterVolumeLevelScalar(out float pfLevel);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDevice {
        int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceEnumerator {
        int f();
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    public class MMDeviceEnumeratorComObject { }

    public class MasterAudio {
        public static float Get() {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice dev = null;
            enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
            var iid = typeof(IAudioEndpointVolume).GUID;
            IAudioEndpointVolume epv = null;
            dev.Activate(ref iid, 23, 0, out epv);
            float vol = 0;
            epv.GetMasterVolumeLevelScalar(out vol);
            return vol * 100.0f;
        }
        public static void Set(float vol) {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            IMMDevice dev = null;
            enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
            var iid = typeof(IAudioEndpointVolume).GUID;
            IAudioEndpointVolume epv = null;
            dev.Activate(ref iid, 23, 0, out epv);
            var guid = System.Guid.Empty;
            epv.SetMasterVolumeLevelScalar(vol / 100.0f, guid);
        }
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'WinAudio.MasterAudio').Type) {
    Add-Type -TypeDefinition $src
}

if ($Action -eq "set") {
    $target = [Math]::Max(0, [Math]::Min(100, $Value))
    [WinAudio.MasterAudio]::Set($target)
    Write-Output ([Math]::Round($target))
} elseif ($Action -eq "add") {
    $current = [WinAudio.MasterAudio]::Get()
    $target = [Math]::Max(0, [Math]::Min(100, $current + $Value))
    [WinAudio.MasterAudio]::Set($target)
    Write-Output ([Math]::Round($target))
} else {
    $current = [WinAudio.MasterAudio]::Get()
    Write-Output ([Math]::Round($current))
}

