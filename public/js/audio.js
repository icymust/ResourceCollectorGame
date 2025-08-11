// Audio Manager для Resource Collector Game
import { AUDIO_SETTINGS } from './constants.js';

export class AudioManager {
  constructor() {
    this.sounds = {};
    this.enabled = AUDIO_SETTINGS.DEFAULT_ENABLED;
    this.volume = AUDIO_SETTINGS.DEFAULT_VOLUME;
    
    // Загружаем настройки из localStorage
    this.loadSettings();
  }

  // Загрузка звука
  loadSound(name, path) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = this.volume;
    this.sounds[name] = audio;
    
    // Обработка ошибок загрузки
    audio.addEventListener('error', (e) => {
      console.warn(`Failed to load sound: ${name}`, e);
    });
    
    return audio;
  }

  // Воспроизведение звука
  play(soundName) {
    if (!this.enabled) return;
    
    const sound = this.sounds[soundName];
    if (sound) {
      // Сброс позиции для повторного воспроизведения
      sound.currentTime = 0;
      
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Sound playback failed: ${soundName}`, error);
        });
      }
    }
  }

  // Включение/выключение звуков
  setEnabled(enabled) {
    this.enabled = enabled;
    this.saveSettings();
  }

  // Установка громкости (0.0 - 1.0)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Обновляем громкость всех загруженных звуков
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
    });
    
    this.saveSettings();
  }

  // Получение текущих настроек
  getSettings() {
    return {
      enabled: this.enabled,
      volume: this.volume
    };
  }

  // Сохранение настроек в localStorage
  saveSettings() {
    const settings = {
      enabled: this.enabled,
      volume: this.volume
    };
    localStorage.setItem(AUDIO_SETTINGS.STORAGE_KEY, JSON.stringify(settings));
  }

  // Загрузка настроек из localStorage
  loadSettings() {
    try {
      const saved = localStorage.getItem(AUDIO_SETTINGS.STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        this.enabled = settings.enabled !== undefined ? settings.enabled : AUDIO_SETTINGS.DEFAULT_ENABLED;
        this.volume = settings.volume !== undefined ? settings.volume : AUDIO_SETTINGS.DEFAULT_VOLUME;
      }
    } catch (error) {
      console.warn('Failed to load audio settings:', error);
      // Используем настройки по умолчанию
      this.enabled = AUDIO_SETTINGS.DEFAULT_ENABLED;
      this.volume = AUDIO_SETTINGS.DEFAULT_VOLUME;
    }
  }

  // Инициализация всех звуков игры
  initGameSounds() {
    // Загружаем звук подбора ресурсов
    this.loadSound('coin-pickup', '/sounds/coin-pickup.wav');
  }
}

// Создаем глобальный экземпляр
export const audioManager = new AudioManager();

// Инициализируем звуки при загрузке модуля
audioManager.initGameSounds();
