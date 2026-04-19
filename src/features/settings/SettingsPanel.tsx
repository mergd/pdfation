import { Dialog } from '@base-ui-components/react/dialog'
import { RadioGroup } from '@base-ui-components/react/radio-group'
import { Radio } from '@base-ui-components/react/radio'

import type { AppSettings, ProviderMode } from '../../../shared/contracts'
import { modelsForProvider } from '../../../shared/models'
import { SyncSection } from '../sync/SyncSection'

import './settings-panel.css'

interface SettingsDialogProps {
  settings: AppSettings
  onChangeUsername: (value: string) => void
  onChangeProviderMode: (mode: ProviderMode) => void
  onChangeModel: (model: string) => void
  onChangeOpenRouterKey: (value: string) => void
  onChangeOpenAiKey: (value: string) => void
}

export const SettingsDialog = ({
  settings,
  onChangeUsername,
  onChangeProviderMode,
  onChangeModel,
  onChangeOpenRouterKey,
  onChangeOpenAiKey,
}: SettingsDialogProps) => {
  const isByo = settings.providerMode === 'byo'
  const isOpenAi = settings.providerMode === 'openai'
  const hasKey =
    (isByo && settings.byoOpenRouterKey.trim().length > 0) ||
    (isOpenAi && settings.byoOpenAiKey.trim().length > 0)
  const models = modelsForProvider(settings.providerMode)

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="btn btn-ghost settings-trigger"
        title="Settings"
      >
        <SettingsCogIcon />
        {(isByo || isOpenAi) && (
          <span className={`settings-trigger__dot ${hasKey ? 'settings-trigger__dot--active' : 'settings-trigger__dot--warn'}`} />
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="settings-backdrop" />
        <Dialog.Popup className="settings-dialog">
          <header className="settings-dialog__header">
            <Dialog.Title className="settings-dialog__title">Settings</Dialog.Title>
            <Dialog.Close className="settings-dialog__close" aria-label="Close">
              <CloseIcon />
            </Dialog.Close>
          </header>

          <div className="settings-dialog__body">
            <div className="settings-dialog__field">
              <label className="settings-dialog__label" htmlFor="username">
                Display name
              </label>
              <input
                id="username"
                className="settings-dialog__input"
                onChange={(event) => onChangeUsername(event.target.value)}
                placeholder="e.g. cosmic-falcon"
                type="text"
                value={settings.username}
              />
              <p className="settings-dialog__hint">
                Visible when you share a document or leave messages on imported copies.
              </p>
            </div>

            <div className="settings-dialog__field">
              <span className="settings-dialog__label">AI Provider</span>
              <RadioGroup
                value={settings.providerMode}
                onValueChange={(value) => onChangeProviderMode(value as ProviderMode)}
                className="settings-dialog__radios"
              >
                <label className="settings-dialog__radio">
                  <Radio.Root value="shared" className="settings-dialog__radio-root">
                    <Radio.Indicator className="settings-dialog__radio-indicator" />
                  </Radio.Root>
                  <div className="settings-dialog__radio-content">
                    <span className="settings-dialog__radio-title">Shared</span>
                    <span className="settings-dialog__radio-desc">Use the shared API quota (rate limited)</span>
                  </div>
                </label>
                <label className="settings-dialog__radio">
                  <Radio.Root value="byo" className="settings-dialog__radio-root">
                    <Radio.Indicator className="settings-dialog__radio-indicator" />
                  </Radio.Root>
                  <div className="settings-dialog__radio-content">
                    <span className="settings-dialog__radio-title">Bring your own key</span>
                    <span className="settings-dialog__radio-desc">Use your own OpenRouter API key</span>
                  </div>
                </label>
                <label className="settings-dialog__radio">
                  <Radio.Root value="openai" className="settings-dialog__radio-root">
                    <Radio.Indicator className="settings-dialog__radio-indicator" />
                  </Radio.Root>
                  <div className="settings-dialog__radio-content">
                    <span className="settings-dialog__radio-title">OpenAI Direct</span>
                    <span className="settings-dialog__radio-desc">Use your own OpenAI API key directly</span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {isByo && (
              <div className="settings-dialog__field">
                <label className="settings-dialog__label" htmlFor="byo-key">
                  OpenRouter API key
                </label>
                <input
                  id="byo-key"
                  className="settings-dialog__input"
                  onChange={(event) => onChangeOpenRouterKey(event.target.value)}
                  placeholder="sk-or-v1-..."
                  type="password"
                  value={settings.byoOpenRouterKey}
                />
                <p className="settings-dialog__hint">
                  Stored locally in your browser. Never sent to our servers.
                </p>
              </div>
            )}

            {isOpenAi && (
              <div className="settings-dialog__field">
                <label className="settings-dialog__label" htmlFor="openai-key">
                  OpenAI API key
                </label>
                <input
                  id="openai-key"
                  className="settings-dialog__input"
                  onChange={(event) => onChangeOpenAiKey(event.target.value)}
                  placeholder="sk-..."
                  type="password"
                  value={settings.byoOpenAiKey}
                />
                <p className="settings-dialog__hint">
                  Stored locally in your browser. Never sent to our servers.
                </p>
              </div>
            )}

            {settings.providerMode === 'shared' ? (
              <div className="settings-dialog__field">
                <span className="settings-dialog__label">Model</span>
                <p className="settings-dialog__hint">
                  Gemini 2.5 Flash is used on the free shared tier. Bring your own key to choose a model.
                </p>
              </div>
            ) : (
              <div className="settings-dialog__field">
                <label className="settings-dialog__label" htmlFor="model-select">
                  Model
                </label>
                <div className="settings-dialog__select-wrap">
                  <select
                    id="model-select"
                    className="settings-dialog__select"
                    value={settings.model}
                    onChange={(event) => onChangeModel(event.target.value)}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronIcon />
                </div>
              </div>
            )}

            <SyncSection settings={settings} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const SettingsCogIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ChevronIcon = () => (
  <svg className="settings-dialog__select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
