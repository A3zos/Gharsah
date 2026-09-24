import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../theme/app_theme.dart';

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

enum TeacherMood {
  /// Talking: bobs, mouth open, sound arcs, green glow.
  speaking,

  /// Leans in, quiet mouth, bigger eyes, gold glow.
  listening,

  /// The reciter plays: still and faded, no glow.
  quiet,
}

/// The one teacher of the whole lesson (frames 18–23): a cartoon teacher in a
/// white thobe and head cover holding a book — the SAME character everywhere,
/// drawn from the design's SVG.
class TeacherCharacter extends StatefulWidget {
  const TeacherCharacter({
    super.key,
    required this.mood,
    this.happy = false,
    this.size = LessonSizes.teacher,
    this.boxHeight = LessonSizes.teacherBox,
    this.onTap,
  });

  final TeacherMood mood;
  final bool happy;
  final double size;
  final double boxHeight;
  final VoidCallback? onTap;

  @override
  State<TeacherCharacter> createState() => _TeacherCharacterState();
}

class _TeacherCharacterState extends State<TeacherCharacter>
    with TickerProviderStateMixin {
  late final AnimationController _body = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1700),
  );
  late final AnimationController _glow = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2100),
  );

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(TeacherCharacter old) {
    super.didUpdateWidget(old);
    if (old.mood != widget.mood) _sync();
  }

  void _sync() {
    final reduce = WidgetsBinding
        .instance
        .platformDispatcher
        .accessibilityFeatures
        .disableAnimations;
    if (widget.mood == TeacherMood.quiet || reduce) {
      _body.stop();
      _glow.stop();
      return;
    }
    // gh-bob 1.7s (speaking) / gh-lean 2.6s (listening), gh-glow 2.1s.
    _body.duration = Duration(
      milliseconds: widget.mood == TeacherMood.speaking ? 1700 : 2600,
    );
    _body.repeat();
    _glow.repeat();
  }

  @override
  void dispose() {
    _body.dispose();
    _glow.dispose();
    super.dispose();
  }

  String _svg() {
    final speaking = widget.mood == TeacherMood.speaking;
    final listening = widget.mood == TeacherMood.listening;
    final eyeR = listening ? 11.5 : 10;
    final skin = _hex(AppColors.teacherSkin);
    final white = _hex(AppColors.surface);
    final eye = _hex(AppColors.teacherEye);
    final eyes = widget.happy
        ? '''
<path d="M75 101 C79 93 89 93 93 101" stroke="$eye" stroke-width="4" stroke-linecap="round"/>
<path d="M107 101 C111 93 121 93 125 101" stroke="$eye" stroke-width="4" stroke-linecap="round"/>'''
        : '''
<ellipse cx="84" cy="98" rx="9" ry="$eyeR" fill="$white"/>
<ellipse cx="116" cy="98" rx="9" ry="$eyeR" fill="$white"/>
<circle cx="85" cy="100" r="5" fill="$eye"/>
<circle cx="117" cy="100" r="5" fill="$eye"/>
<circle cx="87" cy="97" r="1.8" fill="$white"/>
<circle cx="119" cy="97" r="1.8" fill="$white"/>''';
    final mouth = _hex(AppColors.teacherMouth);
    final mouthSvg = speaking
        ? '<ellipse cx="100" cy="121" rx="9" ry="7" fill="$mouth"/>'
        : '<path d="M90 118 C94 125 106 125 110 118" stroke="$mouth" stroke-width="3.4" stroke-linecap="round"/>';
    final gold = _hex(AppColors.gold);
    final arcs = speaking
        ? '''
<path d="M168 92 C176 100 176 112 168 120" stroke="$gold" stroke-width="4.5" stroke-linecap="round"/>
<path d="M181 82 C192 96 192 118 181 132" stroke="$gold" stroke-width="4.5" stroke-linecap="round" opacity="0.5"/>
<path d="M32 92 C24 100 24 112 32 120" stroke="$gold" stroke-width="4.5" stroke-linecap="round"/>
<path d="M19 82 C8 96 8 118 19 132" stroke="$gold" stroke-width="4.5" stroke-linecap="round" opacity="0.5"/>'''
        : '';
    final beard = _hex(AppColors.teacherBeard);
    final capLine = _hex(AppColors.teacherCapLine);
    return '''
<svg viewBox="0 0 200 200" fill="none">
<path d="M56 194 C56 154 72 134 100 134 C128 134 144 154 144 194 Z" fill="$white"/>
<path d="M56 194 C56 164 64 146 78 138 C70 152 66 172 66 194 Z" fill="${_hex(AppColors.teacherShade)}"/>
<path d="M88 138 L100 154 L112 138" stroke="${_hex(AppColors.teacherCollar)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="100" cy="132" rx="13" ry="11" fill="${_hex(AppColors.teacherNeck)}"/>
<ellipse cx="56" cy="94" rx="7" ry="9.5" fill="$skin"/>
<ellipse cx="144" cy="94" rx="7" ry="9.5" fill="$skin"/>
<ellipse cx="100" cy="90" rx="44" ry="46" fill="$skin"/>
<path d="M62 100 C62 138 80 154 100 154 C120 154 138 138 138 100 C130 122 116 128 100 128 C84 128 70 122 62 100 Z" fill="$beard"/>
<path d="M56 78 C56 46 76 28 100 28 C124 28 144 46 144 78 C124 68 76 68 56 78 Z" fill="$white"/>
<path d="M54 78 C76 67 124 67 146 78 C146 87 141 91 135 90 C114 82 86 82 65 90 C59 91 54 87 54 78 Z" fill="${_hex(AppColors.teacherCapBand)}"/>
<path d="M56 78 C56 46 76 28 100 28 C124 28 144 46 144 78" stroke="$capLine" stroke-width="2" stroke-linecap="round"/>
<path d="M74 82 C78 76 90 76 94 81" stroke="$beard" stroke-width="3.4" stroke-linecap="round"/>
<path d="M106 81 C110 76 122 76 126 82" stroke="$beard" stroke-width="3.4" stroke-linecap="round"/>
$eyes
<ellipse cx="68" cy="112" rx="8" ry="5.5" fill="${_hex(AppColors.berry)}" opacity="0.35"/>
<ellipse cx="132" cy="112" rx="8" ry="5.5" fill="${_hex(AppColors.berry)}" opacity="0.35"/>
$mouthSvg
<ellipse cx="60" cy="170" rx="14" ry="22" fill="$white" transform="rotate(14 60 170)"/>
<path d="M46 168 C46 158 52 150 60 148" stroke="$capLine" stroke-width="2" stroke-linecap="round"/>
<g transform="rotate(-9 128 168)">
<rect x="104" y="150" width="48" height="36" rx="6" fill="${_hex(AppColors.deepGreen)}"/>
<rect x="108" y="154" width="40" height="28" rx="4" fill="${_hex(AppColors.hadithPlaceholderBg)}"/>
<path d="M128 154 V182" stroke="${_hex(AppColors.borderStrong)}" stroke-width="2"/>
<path d="M114 162 H124 M132 162 H142 M114 170 H124 M132 170 H142" stroke="${_hex(AppColors.hadithDash)}" stroke-width="2" stroke-linecap="round"/>
</g>
<circle cx="112" cy="186" r="9" fill="$skin"/>
$arcs
</svg>''';
  }

  @override
  Widget build(BuildContext context) {
    final quiet = widget.mood == TeacherMood.quiet;
    final listening = widget.mood == TeacherMood.listening;
    final glowSize = widget.size + 2;
    final art = SvgPicture.string(
      _svg(),
      width: widget.size,
      height: widget.size,
    );
    return Semantics(
      button: widget.onTap != null,
      label: 'تابع مع المعلّم',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: SizedBox(
          height: widget.boxHeight,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (!quiet)
                AnimatedBuilder(
                  animation: _glow,
                  builder: (context, _) {
                    // gh-glow: scale .94 → 1.32, opacity .5 → 0.
                    final t = _glow.value;
                    return Opacity(
                      opacity: 0.5 * (1 - t),
                      child: Transform.scale(
                        scale: 0.94 + 0.38 * t,
                        child: Container(
                          width: glowSize,
                          height: glowSize,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: listening
                                ? AppColors.glowListening
                                : AppColors.glowSpeaking,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              AnimatedBuilder(
                animation: _body,
                builder: (context, child) {
                  final wave = math.sin(_body.value * 2 * math.pi) * 0.5 + 0.5;
                  if (quiet) return Opacity(opacity: 0.76, child: child);
                  if (listening) {
                    // gh-lean: rotate -7°, bob 3px.
                    return Transform.translate(
                      offset: Offset(0, -3 * wave),
                      child: Transform.rotate(
                        angle: -7 * math.pi / 180,
                        child: child,
                      ),
                    );
                  }
                  // gh-bob: up 7px and 1.2°.
                  return Transform.translate(
                    offset: Offset(0, -7 * wave),
                    child: Transform.rotate(
                      angle: 1.2 * wave * math.pi / 180,
                      child: child,
                    ),
                  );
                },
                child: art,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
