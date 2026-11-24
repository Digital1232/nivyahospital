<?php

declare(strict_types=1);

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');

function failRequest(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    failRequest(405, 'Method not allowed.');
}

if (($_SERVER['HTTP_X_NIVYA'] ?? '') !== '1'
    || ($_SERVER['HTTP_ORIGIN'] ?? 'https://www.nivyahospitals.com') !== 'https://www.nivyahospitals.com') {
    failRequest(403, 'Forbidden.');
}

if (!preg_match('~^application/json(?:\s*;|$)~i', $_SERVER['CONTENT_TYPE'] ?? '')) {
    failRequest(415, 'Expected JSON.');
}

$bodyLimit = 128 * 1024;
$body = file_get_contents('php://input', false, null, 0, $bodyLimit + 1);
if ($body === false || strlen($body) > $bodyLimit) {
    failRequest(413, 'Request is too large.');
}

$requestHeaders = ['Content-Type: application/json', 'X-Nivya: 1'];
$cookies = [];
foreach (['nv_rs', 'nv_dv'] as $cookieName) {
    $cookieValue = $_COOKIE[$cookieName] ?? '';
    if (is_string($cookieValue) && $cookieValue !== '') {
        $cookies[] = $cookieName . '=' . rawurlencode($cookieValue);
    }
}
if ($cookies !== []) {
    $requestHeaders[] = 'Cookie: ' . implode('; ', $cookies);
}

$sessionCookies = [];
$request = curl_init('https://nivyahospital.vercel.app/api/reception');
curl_setopt_array($request, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => $requestHeaders,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HEADERFUNCTION => static function ($request, string $line) use (&$sessionCookies): int {
        if (preg_match('/^Set-Cookie:\s*nv_(?:rs|dv)=/i', $line)) {
            $sessionCookies[] = trim($line);
        }
        return strlen($line);
    },
]);

$response = curl_exec($request);
$status = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
$contentType = curl_getinfo($request, CURLINFO_CONTENT_TYPE);

if ($response === false || $status < 200 || ($status >= 300 && $status < 400)
    || stripos($contentType ?? '', 'application/json') !== 0) {
    failRequest(502, 'Reception service is temporarily unavailable.');
}

foreach ($sessionCookies as $sessionCookie) {
    header($sessionCookie, false);
}
http_response_code($status);
echo $response;
