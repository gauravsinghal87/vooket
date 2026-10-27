<?php

namespace App\Infrastructure\Interfaces;

interface MapProviderInterface
{
    public function geocode(string $address): array;

    public function reverseGeocode(float $latitude, float $longitude): array;

    public function placesAutocomplete(string $query, array $options = []): array;

    public function placeDetails(string $placeId, array $options = []): array;

    public function distanceMatrix(array $origins, array $destinations): array;

    public function directions(array $origin, array $destination, array $options = []): array;

    public function calculateDistanceAndTime(array $origin, array $destination): array;

    public function validateAddress(array $latLng): array;
}
