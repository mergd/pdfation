import { RadioGroup } from '@base-ui-components/react/radio-group'
import { Radio } from '@base-ui-components/react/radio'

import type { AppSettings, ProviderMode } from '../../../shared/contracts'

import './settings-panel.css'

interface SettingsPanelProps {
  settings: AppSettings
  onChangeProviderMode: (mode: ProviderMode) => void
  onChangeKey: (value: string) => void
}

export const SettingsPanel = ({
  settings,
  onChangeProviderMode,
  onChangeKey,
}: SettingsPanelProps) => (
  <section className="settings-panel">
    <div className="settings-panel__row">
      <span className="settings-panel__label">Provider</span>
      <RadioGroup
        value={settings.providerMode}
        onValueChange={(value) => onChangeProviderMode(value as ProviderMode)}
        className="settings-panel__radios"
      >
        <label className="settings-panel__radio">
          <Radio.Root value="shared" className="settings-panel__radio-root">
            <Radio.Indicator className="settings-panel__radio-indicator" />
          </Radio.Root>
          Shared
        </label>
        <label className="settings-panel__radio">
          <Radio.Root value="byo" className="settings-panel__radio-root">
            <Radio.Indicator className="settings-panel__radio-indicator" />
          </Radio.Root>
          BYO key
        </label>
      </RadioGroup>
    </div>

    {settings.providerMode === 'byo' && (
      <div className="settings-panel__row">
        <label className="settings-panel__label" htmlFor="byo-key">API key</label>
        <input
          id="byo-key"
          className="settings-panel__key-input"
          onChange={(event) => onChangeKey(event.target.value)}
          placeholder="sk-or-v1-..."
          type="password"
          value={settings.byoOpenRouterKey}
        />
      </div>
    )}
  </section>
)
