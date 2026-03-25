import { useState } from 'react'
import { Popover } from '@base-ui-components/react/popover'
import { RadioGroup } from '@base-ui-components/react/radio-group'
import { Radio } from '@base-ui-components/react/radio'

import type { AppSettings, ProviderMode } from '../../../shared/contracts'

import './settings-panel.css'

interface SettingsDialogProps {
  settings: AppSettings
  onChangeProviderMode: (mode: ProviderMode) => void
  onChangeKey: (value: string) => void
}

export const SettingsDialog = ({
  settings,
  onChangeProviderMode,
  onChangeKey,
}: SettingsDialogProps) => {
  const [open, setOpen] = useState(false)

  const hasKey = settings.providerMode === 'byo' && settings.byoOpenRouterKey.trim().length > 0

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="btn btn-ghost settings-trigger"
        title="Settings"
      >
        <SettingsCogIcon />
        {settings.providerMode === 'byo' && (
          <span className={`settings-trigger__dot ${hasKey ? 'settings-trigger__dot--active' : 'settings-trigger__dot--warn'}`} />
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6}>
          <Popover.Popup className="settings-popover">
            <header className="settings-popover__header">
              <h3 className="settings-popover__title">Settings</h3>
            </header>

            <div className="settings-popover__body">
              <div className="settings-popover__field">
                <span className="settings-popover__label">AI Provider</span>
                <RadioGroup
                  value={settings.providerMode}
                  onValueChange={(value) => onChangeProviderMode(value as ProviderMode)}
                  className="settings-popover__radios"
                >
                  <label className="settings-popover__radio">
                    <Radio.Root value="shared" className="settings-popover__radio-root">
                      <Radio.Indicator className="settings-popover__radio-indicator" />
                    </Radio.Root>
                    Shared
                  </label>
                  <label className="settings-popover__radio">
                    <Radio.Root value="byo" className="settings-popover__radio-root">
                      <Radio.Indicator className="settings-popover__radio-indicator" />
                    </Radio.Root>
                    Bring your own key
                  </label>
                </RadioGroup>
              </div>

              {settings.providerMode === 'byo' && (
                <div className="settings-popover__field">
                  <label className="settings-popover__label" htmlFor="byo-key">
                    OpenRouter API key
                  </label>
                  <input
                    id="byo-key"
                    className="settings-popover__input"
                    onChange={(event) => onChangeKey(event.target.value)}
                    placeholder="sk-or-v1-..."
                    type="password"
                    value={settings.byoOpenRouterKey}
                  />
                  <p className="settings-popover__hint">
                    Stored locally in your browser. Never sent to our servers.
                  </p>
                </div>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

const SettingsCogIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
