//audio manager for Resource Collector Game
import { AUDIO_SETTINGS } from "./constants.js";

export class AudioManager {
  constructor() {
    this.sounds = {};
    this.enabled = AUDIO_SETTINGS.DEFAULT_ENABLED;
    this.volume = AUDIO_SETTINGS.DEFAULT_VOLUME;

    //load settings from localStorage
    this.loadSettings();
  }

  //load sound
  loadSound(name, path) {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = this.volume;
    this.sounds[name] = audio;

    //handle loading errors
    audio.addEventListener("error", (e) => {
      console.warn(`Failed to load sound: ${name}`, e);
    });

    return audio;
  }

  //play sound
  play(soundName) {
    if (!this.enabled) return;

    const sound = this.sounds[soundName];
    if (sound) {
      //reset position for replay
      sound.currentTime = 0;

      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn(`Sound playback failed: ${soundName}`, error);
        });
      }
    }
  }

  //enable/disable sounds
  setEnabled(enabled) {
    this.enabled = enabled;
    this.saveSettings();
  }

  //set volume (0.0 - 1.0)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));

    //update volume for all loaded sounds
    Object.values(this.sounds).forEach((sound) => {
      sound.volume = this.volume;
    });

    this.saveSettings();
  }

  //get current settings
  getSettings() {
    return {
      enabled: this.enabled,
      volume: this.volume,
    };
  }

  //save settings to localStorage
  saveSettings() {
    const settings = {
      enabled: this.enabled,
      volume: this.volume,
    };
    localStorage.setItem(AUDIO_SETTINGS.STORAGE_KEY, JSON.stringify(settings));
  }

  //load settings from localStorage
  loadSettings() {
    try {
      const saved = localStorage.getItem(AUDIO_SETTINGS.STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        this.enabled =
          settings.enabled !== undefined
            ? settings.enabled
            : AUDIO_SETTINGS.DEFAULT_ENABLED;
        this.volume =
          settings.volume !== undefined
            ? settings.volume
            : AUDIO_SETTINGS.DEFAULT_VOLUME;
      }
    } catch (error) {
      console.warn("Failed to load audio settings:", error);
      //use default settings
      this.enabled = AUDIO_SETTINGS.DEFAULT_ENABLED;
      this.volume = AUDIO_SETTINGS.DEFAULT_VOLUME;
    }
  }

  //initialize all game sounds
  initGameSounds() {
    //load resource pickup sound
    this.loadSound("coin-pickup", "/sounds/coin-pickup.wav");
  }
}

//create global instance
export const audioManager = new AudioManager();

//initialize sounds on module load
audioManager.initGameSounds();
