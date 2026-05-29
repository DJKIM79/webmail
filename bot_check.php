<?php
declare(strict_types=1);
session_start();

header('Content-Type: image/svg+xml');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$num1 = rand(1, 9);
$num2 = rand(1, 9);
$ops = ['+', '-'];
$op = $ops[rand(0, 1)];

$question = "$num1 $op $num2";
$answer = ($op === '+') ? ($num1 + $num2) : ($num1 - $num2);

$_SESSION['captcha_answer'] = $answer;

$width = 120;
$height = 40;

echo '<?xml version="1.0" standalone="no"?>';
?>
<svg width="<?php echo $width; ?>" height="<?php echo $height; ?>" xmlns="http://www.w3.org/2000/svg" style="background: #1e1e2e; border-radius: 6px;">
    <!-- Distraction Lines -->
    <line x1="<?php echo rand(0, 30); ?>" y1="<?php echo rand(0, 40); ?>" x2="<?php echo rand(90, 120); ?>" y2="<?php echo rand(0, 40); ?>" stroke="#f5c2e7" stroke-width="1.5" opacity="0.3"/>
    <line x1="<?php echo rand(0, 30); ?>" y1="<?php echo rand(0, 40); ?>" x2="<?php echo rand(90, 120); ?>" y2="<?php echo rand(0, 40); ?>" stroke="#89b4fa" stroke-width="1.5" opacity="0.3"/>
    
    <!-- Render Question -->
    <text x="15" y="26" fill="#cdd6f4" font-size="18" font-family="Courier New, monospace" font-weight="bold" letter-spacing="4">
        <?php echo htmlspecialchars($question); ?> = ?
    </text>
</svg>
