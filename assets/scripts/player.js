import {Howl} from 'howler';
import jQuery from 'jquery';
import PlayerChat from './player-chat';

export default class Player {
  constructor(uri) {
    this.timestamp = 0;
    this.uri = uri;

    this.chat = new PlayerChat();
    this.sound = new Howl({
      src: [uri],
      onload: () => {
        jQuery('[data-player-data="duration"]').text(Player.formatTime(this.sound.duration()));
      },
      onplay: () => {
        jQuery('[data-player-action="play"]').css('display', 'none');
        jQuery('[data-player-action="pause"]').css('display', 'block');

        requestAnimationFrame(this.step.bind(this));
      },
      onpause: () => {
        jQuery('[data-player-action="play"]').css('display', 'block');
        jQuery('[data-player-action="pause"]').css('display', 'none');
      },
    });

    this.registerEventListeners();
  }

  registerEventListeners() {
    jQuery('[data-player-action="pause"]').css('display', 'none');

    jQuery(document).on('click', '[data-player-action="play"]', () => {
      this.play();
    });

    jQuery(document).on('click', '[data-player-action="pause"]', () => {
      this.pause();
    });

    jQuery(document).on('click', '[data-player-action="forward"]', (event) => {
      let amount = jQuery(event.currentTarget).data('amount');

      this.seekTimestamp(this.timestamp + amount);
    });

    jQuery(document).on('click', '[data-player-action="rewind"]', (event) => {
      let amount = jQuery(event.currentTarget).data('amount');

      this.seekTimestamp(this.timestamp - amount);
    });

    jQuery(document).on('click', '[data-player-action="progress"]', (event) => {
      let distance = event.pageX - jQuery(event.currentTarget).offset().left;
      let percentage = distance / jQuery(event.currentTarget).width();

      this.seekPercentage(percentage);
    });

    jQuery(document).on('click', '[data-player-action="play-timestamp"]', (event) => {
      event.stopPropagation();

      let timestamp = jQuery(event.currentTarget).data('timestamp');

      this.seekTimestamp(timestamp);

      if (!this.sound.playing()) {
        this.sound.play();
      }
    });

    jQuery(document).on('click', '.site-episode-part', (event) => {
      let collapse = jQuery(event.currentTarget).find('.collapse');

      if (!collapse.hasClass('show')) {
        collapse.collapse('show');
      }
    });

    jQuery(document).on('show.bs.collapse', '.site-episode-parts .collapse', () => {
      jQuery('.site-episode-parts .collapse.show').collapse('hide');
    });

    jQuery(document).on('submit', 'form[name="episode_part_correction"]', (event) => {
      event.preventDefault();

      let form = jQuery(event.currentTarget);
      let formData = jQuery(event.currentTarget).serialize();

      form.find('[data-form-error]').remove();

      fetch(form.attr('action'), {
        method: 'post',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
        .then(response => {
          if (response.status === 200) {
            jQuery('#correctionModal').modal('hide');
            jQuery('#successModal').modal('show');

            return;
          }

          if (response.status === 400) {
            response.json().then((data) => {
              for (let field in data) {
                if (!data.hasOwnProperty(field)) {
                  continue;
                }

                let errors = data[field];

                let errorSubstitute = form.find('.' + field + '-errors');

                errors.map((message) => {
                  errorSubstitute.after('<div class="form-text text-danger" data-form-error>' + message + '</div>');
                });
              }
            });
          }
        })
      ;
    });

    jQuery(document).on('submit', 'form[name="episode_part_suggestion"]', (event) => {
      event.preventDefault();

      let form = jQuery(event.currentTarget);
      let formData = jQuery(event.currentTarget).serialize();

      form.find('[data-form-error]').remove();

      fetch(form.attr('action'), {
        method: 'post',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
        .then(response => {
          if (response.status === 200) {
            jQuery('#suggestionModal').modal('hide');
            jQuery('#successModal').modal('show');

            return;
          }

          if (response.status === 400) {
            response.json().then((data) => {
              for (let field in data) {
                if (!data.hasOwnProperty(field)) {
                  continue;
                }

                let errors = data[field];

                let errorSubstitute = form.find('.' + field + '-errors');

                errors.map((message) => {
                  errorSubstitute.after('<div class="form-text text-danger" data-form-error>' + message + '</div>');
                });
              }
            });
          }
        })
      ;
    });

    jQuery(document).on('click', '[data-vote-correction]', (event) => {
      let button = jQuery(event.currentTarget);
      let vote = button.data('vote-correction');
      let correction = button.data('correction-id');

      let data = { vote: vote, correction: correction };
      let encodedData = [];

      for (let key in data) {
        encodedData.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
      }

      fetch('/episode/vote', {
        method: 'post',
        body: encodedData.join('&').replace(/%20/g, '+'),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      jQuery('[data-vote-correction][data-correction-id="' + correction + '"]').addClass('d-none');

      let output = jQuery('[data-vote-correction-output="' + vote + '"][data-correction-id="' + correction + '"]');

      let count = +output.html();
      ++count;

      output.html(count);
    });

    jQuery(document).on('change', '[name="episode_part_correction[action]"]', function() {
      let action = this.value;

      jQuery('[data-correction-field]').addClass('d-none');
      jQuery('[data-correction-field="' + action + '"]').removeClass('d-none');
    });

    jQuery('[name="episode_part_correction[action]"]').change();

    jQuery(document).on('show.bs.modal', '#suggestionModal, #correctionModal', (event) => {
      let button = jQuery(event.relatedTarget);
      let partId = button.data('part-id');

      let modal = jQuery(event.currentTarget);
      modal.find('[name$="[part]"]').val(partId);
    });
  }

  play() {
    this.sound.play();

    let timestamp = this.sound.seek() || 0;

    if (timestamp !== this.timestamp) {
      this.sound.seek(this.timestamp);
    }
  }

  pause() {
    this.sound.pause();
  }

  seekPercentage(percentage) {
    let duration = this.sound.duration() || 0;
    let timestamp = percentage * duration;

    if (this.sound.playing()) {
      this.sound.seek(timestamp);
    }
    else {
      this.timestamp = timestamp;

      this.stepInterface(timestamp);
      this.stepTranscript(timestamp);
    }

    this.chat.reset(timestamp);
  }

  seekTimestamp(timestamp) {
    if (this.sound.playing()) {
      this.sound.seek(timestamp);
    }
    else {
      this.timestamp = timestamp;

      this.stepInterface(timestamp);
      this.stepTranscript(timestamp);
    }

    this.chat.reset(timestamp);
  }

  step() {
    let timestamp = this.sound.seek() || 0;

    this.timestamp = timestamp;

    this.stepInterface(timestamp);
    this.stepTranscript(timestamp);
    this.chat.step(timestamp);

    // If the sound is still playing, continue stepping.
    if (this.sound.playing()) {
      requestAnimationFrame(this.step.bind(this));
    }
  }

  stepInterface(timestamp) {
    let duration = this.sound.duration() || 0;
    let progress = (((timestamp / duration) * 100) || 0) + '%';

    jQuery('[data-player-data="timer"]').text(Player.formatTime(timestamp));
    jQuery('[data-player-data="progress"]').css('width', progress);
  }

  stepTranscript(timestamp) {
    let lines = jQuery('.site-transcript-line');

    let lastActiveLine = null;
    let activeLines = [];

    for (let line of lines) {
      let lineDuration = jQuery(line).data('duration');
      let lineTimestamp = jQuery(line).data('timestamp');

      if (lineTimestamp <= timestamp) {
        if (lineDuration !== 0 && lineTimestamp + lineDuration >= timestamp) {
          activeLines.push(line);
        }

        lastActiveLine = line;
      }
    }

    let highlightedLines = jQuery('.site-transcript-line.transcript-highlight');
    let previousLineIsOnScreen = false;

    for (let line of highlightedLines) {
      if (line !== lastActiveLine && activeLines.indexOf(line) === -1) {
        jQuery(line).removeClass('transcript-highlight');
        previousLineIsOnScreen = Player.lineIsOnScreen(line, 0);
      }
    }

    jQuery(lastActiveLine).addClass('transcript-highlight');
    activeLines.map(line => jQuery(line).addClass('transcript-highlight'));

    // Determine if a transition of transcript lines occurred and scrolls to it if it goes out of screen boundary
    if (previousLineIsOnScreen && !Player.lineIsOnScreen(lastActiveLine, 200) && Player.lineIsOnScreen(lastActiveLine, 0)) {
      jQuery('html,body').animate({
        scrollTop: jQuery(lastActiveLine).offset().top + jQuery(lastActiveLine).height() + 250 - jQuery(window).height(),
      });
    }
  }

  static formatTime(value) {
    let hours = Math.floor(value / 60 / 60) || 0;
    let minutes = Math.floor((value - (hours * 60 * 60)) / 60) || 0;
    let seconds = (value - (minutes * 60) - (hours * 60 * 60)) || 0;

    if (hours > 0) {
      return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + Math.trunc(seconds);
    }

    return minutes + ':' + (seconds < 10 ? '0' : '') + Math.trunc(seconds);
  }

  static lineIsOnScreen(element, bottomOffset) {
    let elementTop = jQuery(element).offset().top;
    let elementBottom = elementTop + jQuery(element).outerHeight();

    let viewportTop = jQuery(window).scrollTop();
    let viewportBottom = viewportTop + jQuery(window).height() - bottomOffset;

    return elementTop > viewportTop && elementBottom < viewportBottom;
  };
}
