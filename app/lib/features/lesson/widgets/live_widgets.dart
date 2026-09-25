import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../core/arabic_digits.dart';
import '../../../theme/app_theme.dart';

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

bool _reduceMotion(BuildContext context) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false;

/// «٠٢:٤٦»
String callClock(Duration d) {
  final m = d.inMinutes.remainder(100).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$m:$s'.arabicDigits;
}

/// Repeating 0→1 animation (CSS `infinite` keyframes).
class Looping extends StatefulWidget {
  const Looping({
    super.key,
    required this.duration,
    required this.builder,
    this.delay = Duration.zero,
    this.child,
  });

  final Duration duration;
  final Duration delay;
  final Widget Function(BuildContext context, double t, Widget? child) builder;
  final Widget? child;

  @override
  State<Looping> createState() => _LoopingState();
}

class _LoopingState extends State<Looping> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_reduceMotion(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      Future<void>.delayed(widget.delay, () {
        if (mounted) _c.repeat();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    builder: (context, child) => widget.builder(context, _c.value, child),
    child: widget.child,
  );
}

/// gh-glow pulse ring behind the mic / arrow.
class PulseRing extends StatelessWidget {
  const PulseRing({super.key, required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Looping(
    duration: const Duration(milliseconds: 1500),
    builder: (context, t, _) => Opacity(
      opacity: 0.5 * (1 - t),
      child: Transform.scale(
        scale: 0.94 + 0.38 * t,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color),
        ),
      ),
    ),
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

/// ✕ (end call) · «● مباشر» + call timer.
class LiveCallHeader extends StatelessWidget {
  const LiveCallHeader({super.key, required this.elapsed, required this.onEnd});

  final Duration elapsed;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Semantics(
          button: true,
          label: 'إنهاء المكالمة',
          excludeSemantics: true,
          child: Material(
            color: AppColors.berryTint,
            shape: const CircleBorder(
              side: BorderSide(color: AppColors.berryBorder),
            ),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onEnd,
              child: SizedBox.square(
                dimension: LessonSizes.endCall,
                child: Center(
                  child: SvgPicture.string(
                    '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6 L18 18 M18 6 L6 18" stroke="${_hex(AppColors.berryDeep)}" stroke-width="2.6" stroke-linecap="round"/></svg>',
                    width: 20,
                    height: 20,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  border: Border.all(color: AppColors.berryBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Looping(
                      duration: const Duration(milliseconds: 1400),
                      builder: (context, t, child) => Opacity(
                        // gh-blink: 1 → .25 → 1
                        opacity: 1 - 0.75 * math.sin(t * math.pi),
                        child: child,
                      ),
                      child: Container(
                        width: LessonSizes.liveDot,
                        height: LessonSizes.liveDot,
                        decoration: const BoxDecoration(
                          color: AppColors.berry,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text('مباشر', style: LessonText.live),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(callClock(elapsed), style: LessonText.timer),
            ],
          ),
        ),
        const SizedBox(width: 11 + LessonSizes.endCall),
      ],
    );
  }
}

// ── Mic ─────────────────────────────────────────────────────────────────────

enum MicLook {
  /// Gold, pulse, white mic, voice bars.
  live,

  /// White with the berry slash; [MicControl.prompt] adds the gold ring.
  closed,

  /// Faded, not tappable (teacher praising).
  idle,

  /// Green circle with the arrow (move on).
  goNext,

  /// Gold circle with the arrow (frame 18 «complete»).
  finish,
}

/// The one persistent mic control (never tapped per repeat).
class MicControl extends StatelessWidget {
  const MicControl({
    super.key,
    required this.look,
    required this.semanticLabel,
    this.prompt = false,
    this.dim = false,
    this.onTap,
    this.level,
    this.voiceActive = false,
    this.size = LessonSizes.mic,
    this.glyph = LessonSizes.micGlyph,
    this.barsHeight = LessonSizes.voiceBarsHeight,
  });

  final MicLook look;
  final String semanticLabel;
  final bool prompt;
  final bool dim;
  final VoidCallback? onTap;
  final ValueListenable<double>? level;
  final bool voiceActive;
  final double size;
  final double glyph;
  final double barsHeight;

  static String _micSvg({
    required bool filled,
    required Color ink,
    required bool slash,
  }) {
    final white = _hex(AppColors.surface);
    final i = _hex(ink);
    final body = filled
        ? '<rect x="9" y="3" width="6" height="11" rx="3" fill="$white"/><path d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2" stroke="$white" stroke-width="2.2" stroke-linecap="round"/>'
        : '<rect x="9" y="3" width="6" height="11" rx="3" stroke="$i" stroke-width="2"/><path d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2" stroke="$i" stroke-width="2" stroke-linecap="round"/>';
    final s = slash
        ? '<path d="M4.2 19.8 L19.8 4.2" stroke="${_hex(AppColors.berryDeep)}" stroke-width="2.4" stroke-linecap="round"/>'
        : '';
    return '<svg viewBox="0 0 24 24" fill="none">$body$s</svg>';
  }

  static String _arrowSvg(Color c) =>
      '<svg viewBox="0 0 24 24" fill="none"><path d="M15 5 L8 12 L15 19" stroke="${_hex(c)}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  @override
  Widget build(BuildContext context) {
    final Widget circle;
    switch (look) {
      case MicLook.live:
      case MicLook.finish:
      case MicLook.goNext:
        final green = look == MicLook.goNext;
        circle = Stack(
          alignment: Alignment.center,
          children: [
            PulseRing(
              size: size,
              color: green ? AppColors.goPulse : AppColors.micPulse,
            ),
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: green ? AppColors.deepGreen : AppColors.gold,
                boxShadow: green ? LessonShadows.goNext : LessonShadows.micLive,
              ),
              alignment: Alignment.center,
              child: SvgPicture.string(
                look == MicLook.live
                    ? _micSvg(
                        filled: true,
                        ink: AppColors.surface,
                        slash: false,
                      )
                    : _arrowSvg(AppColors.surface),
                width: look == MicLook.live ? glyph : glyph - 2,
                height: look == MicLook.live ? glyph : glyph - 2,
              ),
            ),
          ],
        );
      case MicLook.closed:
        circle = Stack(
          alignment: Alignment.center,
          children: [
            if (prompt) PulseRing(size: size, color: AppColors.micPromptPulse),
            Opacity(
              opacity: dim ? 0.5 : 1,
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surface,
                  border: Border.all(
                    color: prompt ? AppColors.gold : AppColors.inputBorder,
                    width: 2,
                  ),
                  boxShadow: LessonShadows.micClosed,
                ),
                alignment: Alignment.center,
                child: SvgPicture.string(
                  _micSvg(
                    filled: false,
                    ink: prompt ? AppColors.textDark : AppColors.textMuted,
                    slash: true,
                  ),
                  width: glyph,
                  height: glyph,
                ),
              ),
            ),
          ],
        );
      case MicLook.idle:
        circle = Opacity(
          opacity: 0.45,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.surface,
              border: Border.all(color: AppColors.inputBorder, width: 2),
              boxShadow: LessonShadows.micIdle,
            ),
            alignment: Alignment.center,
            child: SvgPicture.string(
              _micSvg(filled: false, ink: AppColors.textMuted, slash: true),
              width: glyph,
              height: glyph,
            ),
          ),
        );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          button: onTap != null,
          label: semanticLabel,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: SizedBox.square(dimension: size, child: circle),
          ),
        ),
        SizedBox(height: size == LessonSizes.mic ? 8 : 7),
        SizedBox(
          height: barsHeight,
          child: look == MicLook.live
              ? VoiceBars(active: voiceActive, level: level)
              : null,
        ),
      ],
    );
  }
}

/// The child's voice under the live mic (21 bars; calm while the teacher talks).
class VoiceBars extends StatelessWidget {
  const VoiceBars({super.key, required this.active, this.level});

  final bool active;
  final ValueListenable<double>? level;

  @override
  Widget build(BuildContext context) {
    Widget bars(double t, double lvl) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < LessonSizes.voiceBars.length; i++) ...[
          if (i > 0) const SizedBox(width: 3),
          Container(
            width: 3,
            height: active
                ? LessonSizes.voiceBars[i] *
                      (0.22 +
                          0.78 *
                              (0.5 -
                                  0.5 *
                                      math.cos(
                                        2 * math.pi * (t - i * 0.05 / 0.8),
                                      ))) *
                      (0.55 + 0.45 * lvl)
                : 4,
            decoration: BoxDecoration(
              color: active ? AppColors.deepGreen : AppColors.voiceBarOff,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ],
      ],
    );
    if (!active) return bars(0, 0);
    return Looping(
      duration: const Duration(milliseconds: 800),
      builder: (context, t, _) => level == null
          ? bars(t, 1)
          : ValueListenableBuilder<double>(
              valueListenable: level!,
              builder: (context, lvl, _) => bars(t, lvl),
            ),
    );
  }
}

// ── Ayah card ───────────────────────────────────────────────────────────────

/// ﴿ ayah ﴾ in Amiri Quran with gold brackets + reference. The verified Tanzil text
/// is shown exactly as given. No visible play button — the card itself is the
/// silent replay; [onPlayFallback] shows the small play control only when the
/// platform blocked autoplay.
class AyahCard extends StatelessWidget {
  const AyahCard({
    super.key,
    required this.text,
    required this.reference,
    required this.highlighted,
    required this.onTap,
    this.onPlayFallback,
  });

  final String text;
  final String reference;
  final bool highlighted;
  final VoidCallback onTap;
  final VoidCallback? onPlayFallback;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'أعد سماع الآية',
      child: Material(
        color: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LessonRadii.ayahCard),
          side: BorderSide(
            color: highlighted ? AppColors.primary : AppColors.border,
            width: highlighted ? 2 : 1.5,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: DecoratedBox(
            decoration: const BoxDecoration(boxShadow: LessonShadows.ayahCard),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 28, 18, 22),
              child: Column(
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 108),
                    child: Center(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: '﴿', style: LessonText.ayahBracket),
                            TextSpan(text: ' $text ', style: LessonText.ayah),
                            TextSpan(text: '﴾', style: LessonText.ayahBracket),
                          ],
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(reference, style: LessonText.ayahRef),
                  if (onPlayFallback != null) ...[
                    const SizedBox(height: 12),
                    PlayFallback(onTap: onPlayFallback!),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The design's small fallback play — only when autoplay was blocked.
/// TODO(design): exact size/placement not specified in the design.
class PlayFallback extends StatelessWidget {
  const PlayFallback({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'تشغيل التلاوة',
    excludeSemantics: true,
    child: Material(
      color: AppColors.deepGreen,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox.square(
          dimension: AppSizes.minTouch,
          child: Center(
            child: SvgPicture.string(
              '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5.5 V18.5 L18.5 12 Z" fill="${_hex(AppColors.surface)}"/></svg>',
              width: 20,
              height: 20,
            ),
          ),
        ),
      ),
    ),
  );
}

/// Content that slides in from the left on change (gh-swap .45s).
class SwapIn extends StatelessWidget {
  const SwapIn({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    key: key,
    tween: Tween(begin: 0, end: 1),
    duration: const Duration(milliseconds: 450),
    curve: Curves.easeOut,
    builder: (context, t, child) => Opacity(
      opacity: t,
      child: Transform.translate(
        offset: Offset(-26 * (1 - t), 0),
        child: child,
      ),
    ),
    child: child,
  );
}

/// gh-pop: scale .84 → 1.04 → 1 with fade.
class PopIn extends StatelessWidget {
  const PopIn({super.key, required this.child, this.delay = Duration.zero});

  final Widget child;
  final Duration delay;

  @override
  Widget build(BuildContext context) => _Delayed(
    delay: delay,
    builder: (started) => TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: started ? 1 : 0),
      duration: const Duration(milliseconds: 450),
      builder: (context, t, child) {
        final s = t < 0.6
            ? 0.84 + (1.04 - 0.84) * (t / 0.6)
            : 1.04 - 0.04 * ((t - 0.6) / 0.4);
        return Opacity(
          opacity: (t / 0.6).clamp(0, 1),
          child: Transform.scale(scale: s, child: child),
        );
      },
      child: child,
    ),
  );
}

class _Delayed extends StatefulWidget {
  const _Delayed({required this.delay, required this.builder});

  final Duration delay;
  final Widget Function(bool started) builder;

  @override
  State<_Delayed> createState() => _DelayedState();
}

class _DelayedState extends State<_Delayed> {
  late bool _started = widget.delay == Duration.zero;

  @override
  void initState() {
    super.initState();
    if (!_started) {
      Future<void>.delayed(widget.delay, () {
        if (mounted) setState(() => _started = true);
      });
    }
  }

  @override
  Widget build(BuildContext context) => widget.builder(_started);
}

/// Four-point sparkle (gh-spark).
class Sparkle extends StatelessWidget {
  const Sparkle({
    super.key,
    required this.size,
    required this.color,
    this.delay = Duration.zero,
  });

  final double size;
  final Color color;
  final Duration delay;

  @override
  Widget build(BuildContext context) => Looping(
    duration: const Duration(milliseconds: 1800),
    delay: delay,
    builder: (context, t, child) {
      final a = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
      final s = t < 0.45
          ? 0.4 + 0.6 * (t / 0.45)
          : 1 - 0.4 * ((t - 0.45) / 0.55);
      return Opacity(
        opacity: a.clamp(0, 1),
        child: Transform.rotate(
          angle: 24 * t * math.pi / 180,
          child: Transform.scale(scale: s, child: child),
        ),
      );
    },
    child: SvgPicture.string(
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2 L14 9.4 L21.5 12 L14 14.6 L12 22 L10 14.6 L2.5 12 L10 9.4 Z" fill="${_hex(color)}"/></svg>',
      width: size,
      height: size,
    ),
  );
}

/// Gentle up-and-down float (gh-float).
class Floating extends StatelessWidget {
  const Floating({
    super.key,
    required this.child,
    this.distance = 9,
    this.period = const Duration(milliseconds: 3000),
  });

  final Widget child;
  final double distance;
  final Duration period;

  @override
  Widget build(BuildContext context) => Looping(
    duration: period,
    builder: (context, t, child) => Transform.translate(
      offset: Offset(0, -distance * (0.5 - 0.5 * math.cos(2 * math.pi * t))),
      child: child,
    ),
    child: child,
  );
}
