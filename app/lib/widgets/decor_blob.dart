import 'package:flutter/widgets.dart';

/// Soft translucent circle behind a screen's content. Offsets are physical
/// (left/right as in the design), not start/end.
class DecorBlob extends StatelessWidget {
  const DecorBlob({
    super.key,
    required this.size,
    required this.color,
    this.top,
    this.left,
    this.right,
    this.bottom,
  });

  final double size;
  final Color color;
  final double? top, left, right, bottom;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      width: size,
      height: size,
      child: IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }
}
