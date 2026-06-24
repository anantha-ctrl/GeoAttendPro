<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * Email sender.
 *  - If SMTP is configured (MAIL_HOST set) it sends a real email via SMTP
 *    (STARTTLS on 587, implicit TLS on 465) with no external dependency.
 *  - Otherwise it logs the message to storage/logs/mail.log so the system
 *    stays fully functional in local/dev without a mail server.
 */
final class Mailer
{
    public static function send(string $to, string $subject, string $htmlBody): bool
    {
        if (!env('MAIL_HOST')) {
            self::logToFile($to, $subject, $htmlBody);
            return true;
        }
        try {
            self::sendSmtp($to, $subject, $htmlBody);
            return true;
        } catch (\Throwable $e) {
            error_log('Mailer SMTP error: ' . $e->getMessage());
            self::logToFile($to, $subject, $htmlBody); // fallback so OTP is never lost in dev
            return false;
        }
    }

    private static function sendSmtp(string $to, string $subject, string $htmlBody): void
    {
        $host     = (string)env('MAIL_HOST');
        $port     = (int)(env('MAIL_PORT', 587));
        $user     = (string)env('MAIL_USER', '');
        $pass     = (string)env('MAIL_PASS', '');
        $from     = (string)env('MAIL_FROM', $user);
        $fromName = (string)env('MAIL_FROM_NAME', 'GeoAttend Pro');

        $transport = $port === 465 ? "ssl://{$host}:{$port}" : "tcp://{$host}:{$port}";
        $fp = @stream_socket_client($transport, $errno, $errstr, 20);
        if (!$fp) {
            throw new RuntimeException("Connect failed: {$errstr} ({$errno})");
        }
        stream_set_timeout($fp, 20);

        self::read($fp, 220);
        self::cmd($fp, 'EHLO geoattendpro.local', 250);

        if ($port !== 465) {
            self::cmd($fp, 'STARTTLS', 220);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('TLS negotiation failed');
            }
            self::cmd($fp, 'EHLO geoattendpro.local', 250);
        }

        // AUTH LOGIN
        self::cmd($fp, 'AUTH LOGIN', 334);
        self::cmd($fp, base64_encode($user), 334);
        self::cmd($fp, base64_encode($pass), 235);

        self::cmd($fp, "MAIL FROM:<{$from}>", 250);
        self::cmd($fp, "RCPT TO:<{$to}>", 250);
        self::cmd($fp, 'DATA', 354);

        $headers = [
            'From: ' . self::encodeName($fromName) . " <{$from}>",
            "To: <{$to}>",
            'Subject: ' . self::encodeName($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            'Date: ' . date('r'),
        ];
        // Dot-stuffing: lines starting with '.' must be escaped.
        $body = preg_replace('/^\./m', '..', $htmlBody);
        $data = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.";
        self::cmd($fp, $data, 250);

        self::cmd($fp, 'QUIT', 221);
        fclose($fp);
    }

    private static function cmd($fp, string $cmd, int $expect): void
    {
        fwrite($fp, $cmd . "\r\n");
        self::read($fp, $expect);
    }

    private static function read($fp, int $expect): string
    {
        $resp = '';
        while (($line = fgets($fp, 600)) !== false) {
            $resp .= $line;
            // multiline responses use "250-" ; final line uses "250 "
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }
        $code = (int)substr($resp, 0, 3);
        if ($code !== $expect) {
            throw new RuntimeException("SMTP expected {$expect}, got: " . trim($resp));
        }
        return $resp;
    }

    private static function encodeName(string $s): string
    {
        return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    }

    private static function logToFile(string $to, string $subject, string $body): void
    {
        $dir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $entry = sprintf(
            "[%s] TO: %s | SUBJECT: %s\n%s\n%s\n",
            date('Y-m-d H:i:s'), $to, $subject, strip_tags($body), str_repeat('-', 60)
        );
        file_put_contents($dir . '/mail.log', $entry, FILE_APPEND);
    }
}
