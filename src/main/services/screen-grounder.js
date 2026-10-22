const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Screen Grounding Module
 * 
 * Extracts UI elements from the screen using multiple strategies:
 * 1. Windows UI Automation (via PowerShell script) - primary method
 * 2. Windows built-in OCR fallback for elements the accessibility tree misses
 * 
 * Each element gets: id, role, label, x, y, w, h (bounding box)
 */
class ScreenGrounder {
  constructor() {
    this.lastElements = [];
    this.elementIdCounter = 0;
    this.scanScriptPath = path.join(__dirname, 'scripts', 'scan-ui.ps1');
  }

  /**
   * Get all visible interactive elements on screen
   * Returns array of { id, role, label, x, y, w, h }
   */
  async getElements(screenshotBuffer = null) {
    let elements = [];
    let windowInfo = null;

    try {
      // Primary: Windows UI Automation via PowerShell script
      const result = await this.getUIAutomationElements();
      elements = result.elements || [];
      windowInfo = result.window || null;
    } catch (error) {
      console.warn('[ScreenGrounder] UI Automation failed:', error.message);
    }

    // If we got very few elements, try OCR as a fallback
    if (elements.length < 5 && screenshotBuffer) {
      try {
        console.log('[ScreenGrounder] Few UIA elements, trying OCR fallback...');
        const ocrElements = await this.getOCRElements(screenshotBuffer);
        // Merge, avoiding duplicates
        elements = this.mergeElements(elements, ocrElements);
      } catch (error) {
        console.warn('[ScreenGrounder] OCR fallback failed:', error.message);
      }
    }

    // If still empty, generate some demo elements for testing
    if (elements.length === 0) {
      console.log('[ScreenGrounder] No elements found, using demo data');
      elements = this.getDemoElements();
    }

    // Assign sequential IDs
    this.elementIdCounter = 0;
    elements = elements.map(el => ({
      ...el,
      id: ++this.elementIdCounter,
    }));

    // Cap at 250 elements
    elements = elements.slice(0, 250);
    this.lastElements = elements;

    console.log(`[ScreenGrounder] Found ${elements.length} elements`);
    return elements;
  }

  /**
   * Use Windows UI Automation via PowerShell script
   */
  async getUIAutomationElements() {
    return new Promise((resolve, reject) => {
      const scriptPath = this.scanScriptPath.replace(/\\/g, '\\\\');

      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${this.scanScriptPath}"`,
        {
          timeout: 8000,
          maxBuffer: 2 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`UI Automation failed: ${error.message}`));
            return;
          }

          try {
            // Find the JSON in the output (skip any warnings/messages)
            const jsonStr = stdout.trim();
            const jsonStart = jsonStr.indexOf('{');
            if (jsonStart === -1) {
              resolve({ elements: [], window: null });
              return;
            }

            const result = JSON.parse(jsonStr.substring(jsonStart));
            const elements = (result.elements || []).map(el => ({
              id: 0,
              role: el.role || 'unknown',
              label: el.label || '',
              x: el.x || 0,
              y: el.y || 0,
              w: el.w || 0,
              h: el.h || 0,
            }));

            resolve({
              elements,
              window: result.window || null,
            });
          } catch (parseError) {
            console.warn('[ScreenGrounder] JSON parse error:', parseError.message);
            console.warn('[ScreenGrounder] Raw output (first 300 chars):', stdout.substring(0, 300));
            resolve({ elements: [], window: null });
          }
        }
      );
    });
  }

  /**
   * Simple OCR fallback using Windows built-in OCR via PowerShell
   */
  async getOCRElements(screenshotBuffer) {
    return new Promise((resolve, reject) => {
      // Save screenshot to temp file
      const tempPath = path.join(process.env.TEMP || 'C:\\Temp', 'pointy_ocr_screenshot.png');
      fs.writeFileSync(tempPath, screenshotBuffer);

      const ocrScript = `
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
    [Windows.Storage.StorageFile, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null

    $AsTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and !$_.GetParameters()[0].ParameterType.IsGenericType 
    })[0]

    function AsTaskGeneric([object]$WinRtTask, [Type]$ResultType) {
        $AsTaskSpecific = $AsTask.MakeGenericMethod($ResultType)
        $NetTask = $AsTaskSpecific.Invoke($null, @($WinRtTask))
        $NetTask.Wait(-1) | Out-Null
        $NetTask.Result
    }

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $file = AsTaskGeneric ([Windows.Storage.StorageFile]::GetFileFromPathAsync("${tempPath.replace(/\\/g, '\\\\')}")) ([Windows.Storage.StorageFile])
    $stream = AsTaskGeneric ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = AsTaskGeneric ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = AsTaskGeneric ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $ocrResult = AsTaskGeneric ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $results = @()
    foreach ($line in $ocrResult.Lines) {
        $text = $line.Text
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        $words = $line.Words
        if ($words.Count -eq 0) { continue }
        $firstWord = $words[0]
        $lastWord = $words[$words.Count - 1]
        $x = [int]$firstWord.BoundingRect.X
        $y = [int]$firstWord.BoundingRect.Y
        $right = [int]($lastWord.BoundingRect.X + $lastWord.BoundingRect.Width)
        $bottom = [int]($firstWord.BoundingRect.Y + $firstWord.BoundingRect.Height)
        $results += @{
            role = "text"
            label = $text.Substring(0, [Math]::Min($text.Length, 80))
            x = $x
            y = $y
            w = ($right - $x)
            h = ($bottom - $y)
        }
    }
    $results | ConvertTo-Json -Compress
} catch {
    Write-Output "[]"
}
`;

      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command -`,
        {
          timeout: 15000,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          try { fs.unlinkSync(tempPath); } catch (e) { /* ok */ }

          if (error) {
            resolve([]);
            return;
          }

          try {
            const output = stdout.trim() || '[]';
            const jsonStart = output.lastIndexOf('[');
            const parsed = JSON.parse(jsonStart >= 0 ? output.substring(jsonStart) : output);
            const elements = (Array.isArray(parsed) ? parsed : []).map(el => ({
              id: 0,
              role: el.role || 'text',
              label: el.label || '',
              x: el.x || 0,
              y: el.y || 0,
              w: el.w || 0,
              h: el.h || 0,
            }));
            resolve(elements);
          } catch {
            resolve([]);
          }
        }
      ).stdin.end(ocrScript);
    });
  }

  /**
   * Merge UI Automation and OCR elements, avoiding spatial overlaps
   */
  mergeElements(uiaElements, ocrElements) {
    const merged = [...uiaElements];

    for (const ocr of ocrElements) {
      const overlaps = uiaElements.some(uia => {
        const overlapX = Math.max(0, Math.min(uia.x + uia.w, ocr.x + ocr.w) - Math.max(uia.x, ocr.x));
        const overlapY = Math.max(0, Math.min(uia.y + uia.h, ocr.y + ocr.h) - Math.max(uia.y, ocr.y));
        const overlapArea = overlapX * overlapY;
        const ocrArea = ocr.w * ocr.h;
        return ocrArea > 0 && overlapArea / ocrArea > 0.5;
      });

      if (!overlaps) {
        merged.push(ocr);
      }
    }

    return merged;
  }

  /**
   * Demo elements for testing when no real elements are found
   */
  getDemoElements() {
    return [
      { id: 0, role: 'button', label: 'Settings', x: 100, y: 50, w: 100, h: 36 },
      { id: 0, role: 'button', label: 'File', x: 10, y: 10, w: 50, h: 30 },
      { id: 0, role: 'button', label: 'Edit', x: 65, y: 10, w: 50, h: 30 },
      { id: 0, role: 'button', label: 'View', x: 120, y: 10, w: 50, h: 30 },
      { id: 0, role: 'button', label: 'Help', x: 175, y: 10, w: 50, h: 30 },
      { id: 0, role: 'button', label: 'Search', x: 300, y: 50, w: 200, h: 36 },
      { id: 0, role: 'button', label: 'Close', x: 900, y: 10, w: 40, h: 30 },
      { id: 0, role: 'button', label: 'Minimize', x: 820, y: 10, w: 40, h: 30 },
      { id: 0, role: 'button', label: 'Maximize', x: 860, y: 10, w: 40, h: 30 },
    ];
  }

  /**
   * Get the last scanned elements
   */
  getLastElements() {
    return this.lastElements;
  }

  /**
   * Find an element by ID
   */
  getElementById(id) {
    return this.lastElements.find(el => el.id === id) || null;
  }
}

module.exports = { ScreenGrounder };
