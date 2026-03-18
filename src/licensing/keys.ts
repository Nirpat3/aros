/**
 * NirLab ECDSA Public Key (P-256)
 *
 * This public key is safe to ship in the binary.
 * The corresponding private key lives in NirLab's vault ONLY.
 *
 * To rotate: generate new keypair, issue new licenses, update this file.
 */

// Production NirLab public key (PEM format)
// TODO: Replace with actual production public key before first release
export const NIRLAB_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAETuLjNabdA5I2fEpQVAfuX0EKa293\nJRMgVxWoZTKXMQgbtJnF7cwgCXUzvrdNjXK7z2FqSs4mkv7OO0LTIByLuw==\n-----END PUBLIC KEY-----`;

/**
 * Test keypair for CI/testing — DO NOT use in production.
 * Both keys are safe to commit since they're test-only.
 */
export const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHoznfZIPwTah8LO8cxiavjPoXNX7
QIfIKkAExTIBFDfrLpTuzj8KQJcPqpTf+fqypsUHriiC0NN/oqjD0vKdyw==
-----END PUBLIC KEY-----`;

export const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgnWOJzYjvxEG9XQ9k
cHaW12JoaOcRO5sJjw6hRNBajjehRANCAAQejOd9kg/BNqHws7xzGJq+M+hc1ftA
h8gqQATFMgEUN+sulO7OPwpAlw+qlN/5+rKmxQeuKILQ03+iqMPS8p3L
-----END PRIVATE KEY-----`;
