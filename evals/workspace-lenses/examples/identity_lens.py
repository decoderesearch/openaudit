"""A lens in Python: the identity, so it reads out the same as the logit lens.

The harness calls `load_lens(model, layers, hf_model_name)` once. The object it gets back must
have `transport(residual, layer)`: a float32 tensor [..., d_model] at one of `layers` in, a tensor
[..., d_model] in the final-layer basis out. The harness then applies the model's final norm and
unembedding. An object with `.to(device)` is moved to the model's device.

    ./run.sh --lens examples/identity_lens.py --out out/identity-py
"""


class IdentityLens:
    def transport(self, residual, layer):
        return residual


def load_lens(model, layers, hf_model_name):
    return IdentityLens()
