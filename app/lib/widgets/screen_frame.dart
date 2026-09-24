import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Page used by the entry/auth frames: decorative [blobs] behind, safe-area
/// aware, always scrollable (small phones, open keyboard), and at least as tall
/// as the viewport so a [TopBottom] child pins its footer to the bottom — the
/// design's `margin-top: auto`. Content is centred at ≤560 on tablets.
///
/// No intrinsic-height measuring is involved, so it can't under-size and overflow.
class ScreenFrame extends StatelessWidget {
  const ScreenFrame({
    super.key,
    required this.padding,
    required this.child,
    this.blobs = const [],
  });

  final EdgeInsets padding;
  final Widget child;
  final List<Widget> blobs;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          ...blobs,
          SafeArea(
            child: LayoutBuilder(
              builder: (context, viewport) => SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: padding,
                child: Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: AppSizes.maxContentWidth,
                      minHeight: (viewport.maxHeight - padding.vertical).clamp(
                        0,
                        double.infinity,
                      ),
                    ),
                    child: child,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// [top] at the top, [bottom] pushed to the bottom of whatever height the parent
/// allows (at least [minGap] between them). Works inside [ScreenFrame] or any
/// min-height box, without Spacer/Expanded.
class TopBottom extends StatelessWidget {
  const TopBottom({
    super.key,
    required this.top,
    required this.bottom,
    this.minGap = 0,
  });

  final Widget top;
  final Widget bottom;
  final double minGap;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        top,
        Padding(
          padding: EdgeInsets.only(top: minGap),
          child: bottom,
        ),
      ],
    );
  }
}
