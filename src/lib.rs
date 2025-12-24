#![no_std]
#![no_main]

extern crate alloc;

use jam_pvm_common::{
    declare_service,
    Service,
    accumulate::set_storage,
};
use jam_pvm_common::jam_types::*;

declare_service!(MyService);

struct MyService;

impl Service for MyService {
    fn refine(
        _core_index: CoreIndex,
        _item_index: usize,
        _service_id: ServiceId,
        payload: WorkPayload,
        _package_hash: WorkPackageHash,
    ) -> WorkOutput {
        // Increment every byte by 1
        payload.take().iter().map(|b| b.wrapping_add(1)).collect::<alloc::vec::Vec<u8>>().into()
    }

    fn accumulate(
        _slot: Slot,
        _service_id: ServiceId,
        _item_count: usize,
    ) -> Option<Hash> {
        set_storage(b"status", b"processed").ok();
        None
    }
}
