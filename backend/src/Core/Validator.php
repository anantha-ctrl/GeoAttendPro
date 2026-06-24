<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Lightweight rule-based validator.
 *
 * Usage:
 *   $v = new Validator($data, [
 *     'email'    => 'required|email',
 *     'password' => 'required|min:8',
 *     'phone'    => 'nullable|digits_between:7,15',
 *   ]);
 *   if ($v->fails()) { ...$v->errors()... }
 */
final class Validator
{
    private array $errors = [];

    public function __construct(
        private array $data,
        private array $rules
    ) {
        $this->validate();
    }

    private function validate(): void
    {
        foreach ($this->rules as $field => $ruleString) {
            $rules = explode('|', $ruleString);
            $value = $this->data[$field] ?? null;

            $nullable = in_array('nullable', $rules, true);
            if ($nullable && ($value === null || $value === '')) {
                continue;
            }

            foreach ($rules as $rule) {
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                $this->applyRule($field, $value, $name, $arg);
            }
        }
    }

    private function applyRule(string $field, mixed $value, string $rule, ?string $arg): void
    {
        switch ($rule) {
            case 'required':
                if ($value === null || $value === '' || (is_array($value) && count($value) === 0)) {
                    $this->add($field, ucfirst($field) . ' is required.');
                }
                break;
            case 'email':
                if ($value !== null && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->add($field, 'Enter a valid email address.');
                }
                break;
            case 'min':
                if ($value !== null && mb_strlen((string)$value) < (int)$arg) {
                    $this->add($field, ucfirst($field) . " must be at least {$arg} characters.");
                }
                break;
            case 'max':
                if ($value !== null && mb_strlen((string)$value) > (int)$arg) {
                    $this->add($field, ucfirst($field) . " may not exceed {$arg} characters.");
                }
                break;
            case 'numeric':
                if ($value !== null && !is_numeric($value)) {
                    $this->add($field, ucfirst($field) . ' must be numeric.');
                }
                break;
            case 'integer':
                if ($value !== null && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    $this->add($field, ucfirst($field) . ' must be an integer.');
                }
                break;
            case 'date':
                if ($value !== null && !strtotime((string)$value)) {
                    $this->add($field, ucfirst($field) . ' must be a valid date.');
                }
                break;
            case 'in':
                $allowed = explode(',', (string)$arg);
                if ($value !== null && !in_array((string)$value, $allowed, true)) {
                    $this->add($field, ucfirst($field) . ' is invalid.');
                }
                break;
            case 'digits_between':
                [$lo, $hi] = array_pad(explode(',', (string)$arg), 2, '0');
                $len = strlen(preg_replace('/\D/', '', (string)$value));
                if ($len < (int)$lo || $len > (int)$hi) {
                    $this->add($field, ucfirst($field) . " must have {$lo}-{$hi} digits.");
                }
                break;
            case 'confirmed':
                if ($value !== ($this->data[$field . '_confirmation'] ?? null)) {
                    $this->add($field, ucfirst($field) . ' confirmation does not match.');
                }
                break;
            case 'latitude':
                if ($value !== null && (!is_numeric($value) || $value < -90 || $value > 90)) {
                    $this->add($field, 'Invalid latitude.');
                }
                break;
            case 'longitude':
                if ($value !== null && (!is_numeric($value) || $value < -180 || $value > 180)) {
                    $this->add($field, 'Invalid longitude.');
                }
                break;
        }
    }

    private function add(string $field, string $message): void
    {
        $this->errors[$field][] = $message;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    public function errors(): array
    {
        return $this->errors;
    }
}
